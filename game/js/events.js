// ── events.js ────────────────────────────────────────────────────
// All user interaction handlers. Exposed to window for inline onclick.
// Each handler: validate → spend money → update state → animate → re-render.

import { getData, fmtMoney }                          from './data.js';
import { getState, addMoney, spendMoney, buyUpgrade,
         buyGov, unlockSub, setForkChoice,
         getForkChoice, isGovBought, saveState }       from './state.js';
import { checkUnlocks, setSpeed }                     from './engine.js';
import { showAnim }                                   from './animations.js';
import { renderAll }                                  from './ui.js';

// ── Click ─────────────────────────────────────────────────────────
window.handleClick = function() {
  const data  = getData();
  const state = getState();

  addMoney(data.onboarding.initialClickValue);
  state.clicks++;

  _processUnlocks();
  renderAll();
};

// ── Hire intern ───────────────────────────────────────────────────
window.handleHireIntern = function() {
  const data  = getData();
  const state = getState();
  const cost  = data.onboarding.internCost;

  if (!spendMoney(cost)) return;
  state.interns++;
  saveState();
  renderAll();
};

// ── Buy subsidiary upgrade ────────────────────────────────────────
window.handleBuyUpgrade = function(subId, tierIdx, slotIdx) {
  const data  = getData();
  const state = getState();
  const sub   = data.subsidiaries.find(s => s.id === subId);
  if (!sub) return;

  const tier = sub.upgrades[tierIdx];
  if (!tier) return;

  // Check gov prereq for tier 2+
  if (tier.govPrereq && !isGovBought(tier.govPrereq)) return;

  if (!spendMoney(tier.cost)) return;

  buyUpgrade(subId, tierIdx, slotIdx);
  saveState();

  const slot        = tier.slots[slotIdx];
  const displayName = slot.isPlaceholder ? slot.dataPath : slot.name;

  showAnim({
    type:        'upgrade',
    title:       displayName,
    subtitle:    sub.name,
    detail:      `+20% to ${sub.name} income · ${fmtMoney(tier.cost)} spent`,
    autoDismiss: 2000,
  });

  _processUnlocks();
  renderAll();
};

// ── Fork choice ───────────────────────────────────────────────────
window.handleForkChoice = function(forkId, side) {
  const data = getData();
  if (getForkChoice(forkId)) return; // already decided

  const fork   = data.forks.find(f => f.id === forkId);
  const chosen = data.subsidiaries.find(s => s.forkId === forkId && s.forkSide === side);
  if (!chosen) return;

  setForkChoice(forkId, side);
  unlockSub(chosen.id);
  saveState();

  // Note: the unchosen branch is locked for this session.
  // FUTURE: allow repurchase at high cost — forkChoices in state tracks this.
  const other = data.subsidiaries.find(s => s.forkId === forkId && s.forkSide !== side);

  showAnim({
    type:     'fork',
    title:    chosen.name,
    subtitle: `${fork.label} — ${side === 'A' ? 'Option A' : 'Option B'} chosen`,
    detail:   other ? `${other.name} is now locked for this session.` : '',
  });

  _processUnlocks();
  renderAll();
};

// ── Buy gov upgrade ───────────────────────────────────────────────
window.handleBuyGov = function(catId, upgId) {
  const data  = getData();
  const state = getState();
  const cat   = data.governmentTrack.categories.find(c => c.id === catId);
  const upg   = cat?.upgrades.find(u => u.id === upgId);
  if (!upg) return;

  if (state.govPurchased.includes(upgId)) return;
  if (!spendMoney(upg.cost)) return;

  buyGov(upgId);
  saveState();

  showAnim({
    type:        'govtrack',
    title:       upg.name ?? upg.dataPath,
    subtitle:    cat.name,
    detail:      `+5% global income · ${fmtMoney(upg.cost)} spent`,
    autoDismiss: 2500,
  });

  _processUnlocks();
  renderAll();
};

// ── Dev speed control ─────────────────────────────────────────────
window.setGameSpeed = function(x) {
  setSpeed(x);
  document.querySelectorAll('.speed-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`spd-${x}`).classList.add('active');
  renderAll();
};

// ── Internal: check and animate new unlocks ───────────────────────
function _processUnlocks() {
  const events = checkUnlocks();
  events.forEach(ev => {
    if (ev.type === 'subsidiary') {
      showAnim({
        type:     'subsidiary',
        title:    ev.data.name,
        subtitle: `Unlocked at ${fmtMoney(ev.data.unlockThreshold)}`,
        detail:   `${ev.data.ticker} · ${fmtMoney(ev.data.baseRate)}/sec base`,
      });
    } else if (ev.type === 'hq') {
      showAnim({
        type:        'hq',
        title:       ev.data.name,
        subtitle:    `HQ Milestone — ${fmtMoney(ev.data.threshold)}`,
        detail:      ev.data.effect ?? '',
        autoDismiss: 3000,
      });
    }
  });
}
