// ── engine.js ────────────────────────────────────────────────────
// Game loop and all income / unlock calculations.
// No DOM access. Pure numbers in, numbers out.

import { getData }                                          from './data.js';
import { getState, addMoney, isUnlocked, unlockSub,
         isUpgradeBought, isGovBought, isHQActive,
         activateHQ, getForkChoice, saveState }             from './state.js';

// ── Speed multiplier (dev tool) ───────────────────────────────────
let _speed = 1;
export function setSpeed(x) { _speed = x; }
export function getSpeed()  { return _speed; }

// ── Income calculation ────────────────────────────────────────────
// Returns $/sec based on current state.
// Matches the formula in the CMS Formula tab.
export function calcIncome() {
  const data  = getData();
  const state = getState();
  let total   = 0;

  // Intern passive income
  total += state.interns * data.onboarding.internPassiveRate;

  // Subsidiary income
  data.subsidiaries.forEach(sub => {
    if (!isUnlocked(sub.id)) return;

    // Skip the unchosen side of a fork
    if (sub.forkId) {
      const choice = getForkChoice(sub.forkId);
      if (choice && choice !== sub.forkSide) return;
    }

    // Base rate × upgrade multiplier
    // Each purchased upgrade adds +20% of base rate (additive)
    let upgradeMult = 1;
    sub.upgrades.forEach((tier, ti) => {
      tier.slots.forEach((_, si) => {
        if (isUpgradeBought(sub.id, ti, si)) upgradeMult += 0.2;
      });
    });

    total += sub.baseRate * upgradeMult;
  });

  // Gov track global bonus: +5% per gov upgrade owned
  total *= 1 + state.govPurchased.length * 0.05;

  // HQ bonuses: each activated HQ upgrade adds a flat +25% global
  // (placeholder — real effects are in the effect string, needs parsing later)
  total *= Math.pow(1.25, state.hqActivated.length);

  return total * _speed;
}

// ── Tick ──────────────────────────────────────────────────────────
let _tickTimer  = null;
let _onTick     = null;
const TICK_MS   = 100; // 10 updates/sec

export function startLoop(onTick) {
  _onTick = onTick;
  getState().lastTick = Date.now();
  _tickTimer = setInterval(_tick, TICK_MS);
}

export function stopLoop() {
  if (_tickTimer) clearInterval(_tickTimer);
  _tickTimer = null;
}

function _tick() {
  const state = getState();
  const now   = Date.now();
  const dt    = (now - (state.lastTick ?? now)) / 1000; // seconds
  state.lastTick = now;

  const income = calcIncome();
  if (income > 0) addMoney(income * dt);

  saveState();
  if (_onTick) _onTick();
}

// ── Unlock checks ─────────────────────────────────────────────────
// Returns arrays of newly unlocked things so the caller can animate them.
// Safe to call on every tick — only returns items not yet unlocked/activated.
export function checkUnlocks() {
  const data   = getData();
  const state  = getState();
  const events = [];            // { type, id, data }

  // Subsidiaries (non-fork only — forks are handled by player choice)
  data.subsidiaries.forEach(sub => {
    if (isUnlocked(sub.id)) return;
    if (sub.forkId)         return; // fork subs unlock via handleForkChoice
    if (state.totalRevenue >= sub.unlockThreshold) {
      unlockSub(sub.id);
      events.push({ type: 'subsidiary', id: sub.id, data: sub });
    }
  });

  // HQ milestones (auto-activate when threshold reached)
  data.hqUpgrades.forEach(hq => {
    if (isHQActive(hq.id)) return;
    if (hq.threshold && state.totalRevenue >= hq.threshold) {
      activateHQ(hq.id);
      events.push({ type: 'hq', id: hq.id, data: hq });
    }
  });

  return events;
}
