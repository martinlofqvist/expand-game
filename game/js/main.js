// ── main.js ──────────────────────────────────────────────────────
// Entry point. Wires everything together.
// Import order matters: data → state → engine → ui → events

import { loadGameData }          from './data.js';
import { initState, hasSavedSession, resetState } from './state.js';
import { startLoop, checkUnlocks } from './engine.js';
import { renderAll, tickUpdate } from './ui.js';
import { showAnim }              from './animations.js';

// events.js registers window.handleClick etc. — just importing it is enough
import './events.js';

// ── Boot ──────────────────────────────────────────────────────────
async function boot() {
  try {
    await loadGameData();
  } catch (e) {
    console.error('Failed to load game data:', e);
    document.body.innerHTML = `<p style="padding:40px;font-family:Helvetica">
      Error loading game data: ${e.message}<br>
      Make sure you're running from a local server (not file://).
    </p>`;
    return;
  }

  initState();

  // Populate start screen copy from game data
  const ss = getData().ui?.startScreen ?? {};
  document.getElementById('start-headline').textContent = ss.headline   ?? 'EXPAND!';
  document.getElementById('start-tagline').textContent  = ss.tagline    ?? '';
  document.getElementById('start-cta').textContent      = ss.ctaButton  ?? 'START GAME';
  document.getElementById('start-resume').textContent   = ss.resumeNote ?? '';

  if (hasSavedSession()) {
    document.getElementById('start-resume').hidden = false;
  }

  // Show start screen
  document.getElementById('start-screen').classList.remove('hidden');
}

// ── Start game ────────────────────────────────────────────────────
window.startGame = function() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('game').hidden = false;

  // Apply any pending unlocks from a restored session
  const unlockEvents = checkUnlocks();
  // (don't animate unlocks from restored state — just render them silently)

  renderAll();

  // Tick loop: full render throttled, lightweight money update every tick
  let renderPending = false;
  startLoop(() => {
    // Lightweight: update money bar + button states every tick
    tickUpdate();

    // Check for new unlocks every tick but only trigger once per batch
    const events = checkUnlocks();
    if (events.length > 0 && !renderPending) {
      renderPending = true;
      requestAnimationFrame(() => {
        events.forEach(ev => {
          if (ev.type === 'subsidiary') {
            showAnim({
              type:     'subsidiary',
              title:    ev.data.name,
              subtitle: `Unlocked at ${_fmt(ev.data.unlockThreshold)}`,
              detail:   `${ev.data.ticker} · ${_fmt(ev.data.baseRate)}/sec base`,
            });
          } else if (ev.type === 'hq') {
            showAnim({
              type:        'hq',
              title:       ev.data.name,
              subtitle:    `HQ Milestone`,
              detail:      ev.data.effect ?? '',
              autoDismiss: 3000,
            });
          }
        });
        renderAll();
        renderPending = false;
      });
    }
  });
};

// Simple local fmt (avoids circular import for this one use)
function _fmt(n) {
  if (!n) return '$0';
  if (n >= 1e12) return '$' + (n/1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return '$' + (n/1e9).toFixed(1)  + 'B';
  if (n >= 1e6)  return '$' + (n/1e6).toFixed(1)  + 'M';
  if (n >= 1e3)  return '$' + (n/1e3).toFixed(0)  + 'K';
  return '$' + Math.floor(n);
}

boot();
