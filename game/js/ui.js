// ── ui.js ────────────────────────────────────────────────────────
// All DOM rendering. Reads state + data, writes HTML. No game logic here.

import { getData, fmtMoney }                                from './data.js';
import { getState, isUnlocked, isUpgradeBought, isGovBought,
         getForkChoice, isHQActive }                        from './state.js';
import { calcIncome, getSpeed }                             from './engine.js';

let _activeSubId = null; // currently selected subsidiary tab

// ── Full render (called on purchase + after fork choice) ──────────
export function renderAll() {
  const data  = getData();
  const state = getState();

  _updateMoneyBar(data, state);
  _renderInterns(data, state);
  _renderForks(data, state);
  _renderSubZone(data, state);
  _renderGovZone(data, state);
  _renderHQZone(data, state);
}

// ── Lightweight tick update (called 10×/sec) ──────────────────────
// Only updates numbers — avoids full DOM rebuild on every tick.
export function tickUpdate() {
  const data  = getData();
  const state = getState();
  _updateMoneyBar(data, state);
  _updateBuyButtonStates(state);
}

// ── Money bar ─────────────────────────────────────────────────────
function _updateMoneyBar(data, state) {
  const income = calcIncome();
  document.getElementById('money-display').textContent  = fmtMoney(state.money);
  document.getElementById('income-display').textContent = fmtMoney(income / getSpeed()) + '/sec';
  document.getElementById('revenue-display').textContent = fmtMoney(state.totalRevenue) + ' total';
}

// ── Intern bar ────────────────────────────────────────────────────
function _renderInterns(data, state) {
  const ob  = data.onboarding;
  const bar = document.getElementById('intern-bar');
  if (state.clicks < ob.internUnlockAfterClicks) { bar.hidden = true; return; }
  bar.hidden = false;

  document.getElementById('intern-count').textContent        = state.interns;
  document.getElementById('intern-cost-display').textContent = ob.internCost;
  document.getElementById('intern-income').textContent =
    state.interns > 0 ? `+${fmtMoney(state.interns * ob.internPassiveRate)}/sec` : '';

  const hireBtn = document.getElementById('hire-btn');
  hireBtn.disabled = state.money < ob.internCost;

  const flavor = document.getElementById('intern-flavor');
  if (state.interns === 1 && ob.internFlavorText) {
    flavor.textContent = ob.internFlavorText;
    flavor.hidden = false;
  }
}

// ── Fork zone ─────────────────────────────────────────────────────
function _renderForks(data, state) {
  const zone    = document.getElementById('fork-zone');
  const content = document.getElementById('fork-zone');

  // Find forks whose threshold has been crossed but not yet decided
  const pending = data.forks.filter(f => {
    if (getForkChoice(f.id)) return false;            // already chosen
    return state.totalRevenue >= f.threshold;
  });

  if (pending.length === 0) { zone.hidden = true; return; }
  zone.hidden = false;

  zone.innerHTML = pending.map(fork => {
    const opts = fork.options
      .map(subId => data.subsidiaries.find(s => s.id === subId))
      .filter(Boolean);

    const optBtns = opts.map(sub => `
      <button class="fork-option-btn"
              onclick="window.handleForkChoice('${fork.id}', '${sub.forkSide}')">
        <span class="fork-option-name">${sub.name}</span>
        <span class="fork-option-meta">${sub.ticker} · ${sub.category}</span>
      </button>
    `).join('');

    return `
      <div class="fork-block">
        <div class="fork-label-text">${fork.label}</div>
        <div class="fork-threshold-text">Reached at ${fmtMoney(fork.threshold)}</div>
        <div class="fork-options">${optBtns}</div>
      </div>`;
  }).join('');
}

// ── Subsidiary zone ───────────────────────────────────────────────
function _renderSubZone(data, state) {
  const zone = document.getElementById('sub-zone');

  // Collect visible subsidiaries (unlocked + not the unchosen fork side)
  const visible = data.subsidiaries.filter(sub => {
    if (!isUnlocked(sub.id)) return false;
    if (sub.forkId) {
      const choice = getForkChoice(sub.forkId);
      if (choice && choice !== sub.forkSide) return false;
    }
    return true;
  });

  if (visible.length === 0) { zone.hidden = true; return; }
  zone.hidden = false;

  // Default active tab
  if (!_activeSubId || !visible.find(s => s.id === _activeSubId)) {
    _activeSubId = visible[0].id;
  }

  // Tab bar
  document.getElementById('sub-tabs').innerHTML = visible.map(sub => `
    <button class="sub-tab ${sub.id === _activeSubId ? 'active' : ''}"
            onclick="window.switchSubTab('${sub.id}')">
      ${sub.ticker}
    </button>
  `).join('');

  // Tab content
  const active = visible.find(s => s.id === _activeSubId);
  if (active) _renderSubContent(active, state);
}

function _renderSubContent(sub, state) {
  const income = _subIncome(sub, state);

  const tiersHtml = sub.upgrades.map((tier, ti) => {
    const prereqMet = !tier.govPrereq || isGovBought(tier.govPrereq);
    const lockedTag = !prereqMet
      ? `<span class="tier-locked-tag">Requires gov: ${tier.govPrereq}</span>` : '';

    const slotsHtml = tier.slots.map((slot, si) => {
      const bought = isUpgradeBought(sub.id, ti, si);
      const canAfford = state.money >= tier.cost;

      const nameHtml = slot.isPlaceholder
        ? `<span class="upgrade-name is-path">${slot.dataPath}</span>`
        : `<span class="upgrade-name">${slot.name}</span>`;

      const actionHtml = bought
        ? `<span class="purchased-mark">✓</span>`
        : !prereqMet ? ''
        : `<button class="buy-btn ${canAfford ? '' : 'unaffordable'}"
                   data-cost="${tier.cost}"
                   onclick="window.handleBuyUpgrade('${sub.id}', ${ti}, ${si})">
             ${fmtMoney(tier.cost)}
           </button>`;

      const cls = bought ? 'is-purchased' : !prereqMet ? 'is-locked' : '';
      return `<div class="upgrade-row ${cls}">${nameHtml}${actionHtml}</div>`;
    }).join('');

    return `
      <div class="tier-block">
        <div class="tier-label">Tier ${tier.tier} ${lockedTag}</div>
        <div>${slotsHtml}</div>
      </div>`;
  }).join('');

  document.getElementById('sub-content').innerHTML = `
    <div class="sub-header">
      <span class="sub-name-big">${sub.name}</span>
      <span class="sub-ticker-tag">${sub.ticker}</span>
      <span class="sub-rate-tag">base ${fmtMoney(sub.baseRate)}/sec</span>
      <span class="sub-rate-current">→ ${fmtMoney(income / getSpeed())}/sec now</span>
    </div>
    ${tiersHtml}`;
}

function _subIncome(sub, state) {
  let upgradeMult = 1;
  sub.upgrades.forEach((tier, ti) => {
    tier.slots.forEach((_, si) => {
      if (isUpgradeBought(sub.id, ti, si)) upgradeMult += 0.2;
    });
  });
  return sub.baseRate * upgradeMult * getSpeed();
}

// ── Gov zone ──────────────────────────────────────────────────────
function _renderGovZone(data, state) {
  const zone = document.getElementById('gov-zone');

  // Show gov zone once the player has at least one subsidiary T1 upgrade
  const hasUpgrade = Object.values(state.upgrades).some(sub =>
    Object.values(sub).flat().some(Boolean)
  );
  if (!hasUpgrade) { zone.hidden = true; return; }
  zone.hidden = false;

  const catsHtml = data.governmentTrack.categories.map(cat => {
    const rowsHtml = cat.upgrades.map(u => {
      const bought     = isGovBought(u.id);
      const canAfford  = state.money >= u.cost;
      const nameHtml   = u.dataPath
        ? `<span class="gov-row-name is-path">${u.dataPath}</span>`
        : `<span class="gov-row-name">${u.name}</span>`;

      const actionHtml = bought
        ? `<span class="purchased-mark">✓</span>`
        : `<button class="buy-btn ${canAfford ? '' : 'unaffordable'}"
                   data-cost="${u.cost}"
                   onclick="window.handleBuyGov('${cat.id}', '${u.id}')">
             ${fmtMoney(u.cost)}
           </button>`;

      return `<div class="gov-row ${bought ? 'is-purchased' : ''}">${nameHtml}${actionHtml}</div>`;
    }).join('');

    return `<div class="gov-category"><div class="gov-cat-name">${cat.name}</div>${rowsHtml}</div>`;
  }).join('');

  document.getElementById('gov-content').innerHTML = catsHtml;
}

// ── HQ zone ───────────────────────────────────────────────────────
function _renderHQZone(data, state) {
  const zone = document.getElementById('hq-zone');

  // Show once first HQ milestone has been hit
  const anyActive = data.hqUpgrades.some(u => isHQActive(u.id));
  if (!anyActive) { zone.hidden = true; return; }
  zone.hidden = false;

  const rowsHtml = data.hqUpgrades.map(u => {
    const active  = isHQActive(u.id);
    const reached = state.totalRevenue >= u.threshold;
    const cls     = active ? 'is-purchased' : !reached ? 'is-locked' : '';

    return `
      <div class="hq-row ${cls}">
        <div class="hq-row-info">
          <div class="hq-row-name">${u.name}</div>
          <div class="hq-row-effect">${u.effect ?? '—'}</div>
        </div>
        <div class="hq-row-threshold">${fmtMoney(u.threshold)}</div>
        ${active ? '<div class="hq-activated">ACTIVE</div>' : ''}
      </div>`;
  }).join('');

  document.getElementById('hq-content').innerHTML = rowsHtml;
}

// ── Buy button affordability (lightweight tick update) ────────────
function _updateBuyButtonStates(state) {
  document.querySelectorAll('.buy-btn[data-cost]').forEach(btn => {
    const cost = parseFloat(btn.dataset.cost);
    const affordable = state.money >= cost;
    btn.classList.toggle('unaffordable', !affordable);
  });

  const hireBtn = document.getElementById('hire-btn');
  if (hireBtn) {
    const cost = parseFloat(document.getElementById('intern-cost-display').textContent);
    hireBtn.disabled = state.money < cost;
  }
}

// ── Tab switch (exposed to window) ───────────────────────────────
window.switchSubTab = function(subId) {
  _activeSubId = subId;
  const data  = getData();
  const state = getState();
  _renderSubZone(data, state);
};
