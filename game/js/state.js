// ── state.js ─────────────────────────────────────────────────────
// All mutable game state. No DOM, no logic — pure data.
//
// FUTURE: Replace sessionStorage with per-user Firestore documents.
// When user login is added, call loadStateFromFirestore(userId) instead of
// initState(), and saveState() should write to Firestore + sessionStorage.
// See: https://firebase.google.com/docs/firestore/manage-data/add-data

const SESSION_KEY = 'expand_v1_state';

// ── Default (new game) state ──────────────────────────────────────
const DEFAULTS = {
  started:   false,
  money:     0,
  totalRevenue: 0,   // all-time earned — used for unlock checks
  clicks:    0,
  interns:   0,

  // Arrays of unlocked subsidiary IDs
  unlockedSubs: [],

  // Fork choices: { forkId: 'A' | 'B' }
  forkChoices: {},

  // Purchased upgrades: { subId: { tierIndex: [bool×5] } }
  // e.g. { publishing: { 0: [true,false,false,false,false] } }
  upgrades: {},

  // Gov track upgrade IDs that have been purchased
  govPurchased: [],

  // HQ upgrade IDs that have been activated (threshold reached)
  hqActivated: [],

  // Tick timestamp (ms)
  lastTick: null,
};

let _state = null;

// ── Init ──────────────────────────────────────────────────────────
export function initState() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      _state = { ...DEFAULTS, ...JSON.parse(saved) };
      return;
    }
  } catch (e) {
    console.warn('Could not restore session:', e);
  }
  _state = JSON.parse(JSON.stringify(DEFAULTS));
}

export function resetState() {
  _state = JSON.parse(JSON.stringify(DEFAULTS));
  sessionStorage.removeItem(SESSION_KEY);
}

export function saveState() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(_state));
  } catch (e) {
    console.warn('Could not save session:', e);
  }
}

export function hasSavedSession() {
  return !!sessionStorage.getItem(SESSION_KEY);
}

// ── Read ──────────────────────────────────────────────────────────
export function getState() { return _state; }

// ── Money ─────────────────────────────────────────────────────────
export function addMoney(amount) {
  _state.money        += amount;
  _state.totalRevenue += amount;
}

export function spendMoney(amount) {
  if (_state.money < amount) return false;
  _state.money -= amount;
  return true;
}

// ── Subsidiaries ──────────────────────────────────────────────────
export function isUnlocked(subId) {
  return _state.unlockedSubs.includes(subId);
}

export function unlockSub(subId) {
  if (!isUnlocked(subId)) _state.unlockedSubs.push(subId);
}

// ── Forks ─────────────────────────────────────────────────────────
export function getForkChoice(forkId) {
  return _state.forkChoices[forkId] ?? null;
}

export function setForkChoice(forkId, side) {
  _state.forkChoices[forkId] = side;
}

// ── Upgrades ──────────────────────────────────────────────────────
export function isUpgradeBought(subId, tierIdx, slotIdx) {
  return !!_state.upgrades[subId]?.[tierIdx]?.[slotIdx];
}

export function buyUpgrade(subId, tierIdx, slotIdx) {
  if (!_state.upgrades[subId])           _state.upgrades[subId] = {};
  if (!_state.upgrades[subId][tierIdx])  _state.upgrades[subId][tierIdx] = [false,false,false,false,false];
  _state.upgrades[subId][tierIdx][slotIdx] = true;
}

export function upgradeCountFor(subId) {
  const sub = _state.upgrades[subId];
  if (!sub) return 0;
  return Object.values(sub).flat().filter(Boolean).length;
}

// ── Gov Track ─────────────────────────────────────────────────────
export function isGovBought(id) {
  return _state.govPurchased.includes(id);
}

export function buyGov(id) {
  if (!isGovBought(id)) _state.govPurchased.push(id);
}

// ── HQ ────────────────────────────────────────────────────────────
export function isHQActive(id) {
  return _state.hqActivated.includes(id);
}

export function activateHQ(id) {
  if (!isHQActive(id)) _state.hqActivated.push(id);
}
