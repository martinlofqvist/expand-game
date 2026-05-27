// ── data.js ──────────────────────────────────────────────────────
// Loads game-data.json and derives placeholder values for anything null.
// All pricing/rate constants live here — easy to tune without touching logic.
//
// NOTE: When baseRate is set in the CMS, the derived value is ignored.
// When upgrade costs are defined in the CMS, placeholder values are ignored.

let _data = null;

export async function loadGameData() {
  const res = await fetch('../data/game-data.json');
  if (!res.ok) throw new Error(`Failed to load game data: ${res.status}`);
  const raw = await res.json();
  _data = deriveValues(raw);
  return _data;
}

function deriveValues(raw) {
  const d = JSON.parse(JSON.stringify(raw)); // deep clone, never mutate source

  d.subsidiaries.forEach(sub => {

    // ── Base rate ──────────────────────────────────────────────
    // If CMS has set a baseRate, use it. Otherwise derive a placeholder.
    // Formula: sqrt-ish scaling so early subs feel meaningful.
    if (sub.baseRate === null || sub.baseRate === undefined) {
      sub.baseRate = sub.unlockThreshold === 0
        ? 2                                            // Publishing starts at $2/sec
        : Math.max(2, sub.unlockThreshold / 1000);    // e.g. $250K → $250/sec
    }

    // ── Upgrade costs ──────────────────────────────────────────
    // Placeholder: tier 1 = threshold/50, tier 2 = ×10, tier 3 = ×100
    // Minimum $10 per upgrade.
    const baseCost = Math.max(10, sub.unlockThreshold / 50);
    const tierMult = [1, 10, 100];

    sub.upgrades.forEach((tier, ti) => {
      tier.cost = Math.round(baseCost * tierMult[ti]);

      // Each tier may have fewer than 5 items — pad to 5 for the game grid.
      // Slots beyond items.length are "missing copy" — show data path.
      tier.slots = Array.from({ length: 5 }, (_, si) => {
        const item = tier.items?.[si];
        return item
          ? { id: item.id, name: item.name, isPlaceholder: false }
          : {
              id: `${sub.id}_t${tier.tier}_s${si + 1}`,
              name: null,
              dataPath: `${sub.id}.Tier${tier.tier}.Upgrade${si + 1}`,
              isPlaceholder: true,
            };
      });
    });
  });

  // ── Gov track costs ────────────────────────────────────────────
  // Scale by category tier. Each category is roughly 10× more expensive.
  const govCategoryBase = [500_000, 5_000_000, 50_000_000, 500_000_000];
  d.governmentTrack.categories.forEach((cat, ci) => {
    cat.upgrades.forEach((u, ui) => {
      u.cost = govCategoryBase[ci] * (ui + 1);

      // Flag missing names as data paths
      if (!u.name || !u.name.trim()) {
        u.dataPath = `gov.${cat.id}.Upgrade${ui + 1}`;
      }
    });
  });

  // ── HQ upgrades ────────────────────────────────────────────────
  // HQ upgrades are milestone bonuses — they activate automatically when
  // totalRevenue crosses their threshold. No purchase cost.
  // The "shareholder_value" upgrade triggers the endgame.

  return d;
}

export function getData() {
  if (!_data) throw new Error('Game data not loaded');
  return _data;
}

// ── Formatting helpers (used across modules) ──────────────────────
export function fmtMoney(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1e18) return '$' + (n / 1e18).toFixed(1) + 'Qi';
  if (n >= 1e15) return '$' + (n / 1e15).toFixed(1) + 'Q';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1)  + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(1)  + 'M';
  if (n >= 1e3)  return '$' + (n / 1e3).toFixed(0)  + 'K';
  return '$' + Math.floor(n);
}
