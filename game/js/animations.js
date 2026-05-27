// ── animations.js ────────────────────────────────────────────────
// Unified animation system for all unlock/purchase events.
//
// All three event types use the same overlay component:
//   - Subsidiary unlock
//   - Upgrade purchase
//   - Gov Track purchase
//   - Fork choice confirmation
//   - HQ milestone
//
// To add image/video: set opts.mediaPath and the media slot will
// render an <img> or <video> instead of the placeholder box.
//
// USAGE:
//   showAnim({ type, title, subtitle, detail, mediaPath, autoDismiss })
//   dismissAnim()

const QUEUE   = [];
let   _active = false;

const TYPE_LABELS = {
  subsidiary: 'SUBSIDIARY UNLOCKED',
  upgrade:    'UPGRADE PURCHASED',
  govtrack:   'GOVERNMENT INFLUENCE',
  hq:         'HQ MILESTONE',
  fork:       'EXPANSION FORK',
};

/**
 * Queue an animation. Plays immediately if nothing is showing.
 * @param {object} opts
 *   type        - 'subsidiary' | 'upgrade' | 'govtrack' | 'hq' | 'fork'
 *   title       - main headline text
 *   subtitle    - secondary line (optional)
 *   detail      - small third line (optional)
 *   mediaPath   - path to image or video asset (optional, future use)
 *   autoDismiss - ms before auto-dismissing (0 or omit = manual dismiss)
 */
export function showAnim(opts) {
  QUEUE.push(opts);
  if (!_active) _next();
}

export function dismissAnim() {
  const overlay = document.getElementById('anim-overlay');
  overlay.classList.add('anim-fade-out');
  setTimeout(() => {
    overlay.hidden = true;
    overlay.classList.remove('anim-fade-out', 'anim-fade-in');
    _active = false;
    _next();
  }, 200);
}

function _next() {
  if (QUEUE.length === 0) return;
  _active = true;
  const opts = QUEUE.shift();

  const overlay     = document.getElementById('anim-overlay');
  const mediaSlot   = document.getElementById('anim-media');
  const typeEl      = document.getElementById('anim-type');
  const titleEl     = document.getElementById('anim-title');
  const subtitleEl  = document.getElementById('anim-subtitle');
  const detailEl    = document.getElementById('anim-detail');
  const placeholder = document.getElementById('anim-media-placeholder');

  typeEl.textContent     = TYPE_LABELS[opts.type] ?? opts.type.toUpperCase();
  titleEl.textContent    = opts.title    ?? '';
  subtitleEl.textContent = opts.subtitle ?? '';
  detailEl.textContent   = opts.detail   ?? '';

  // Media slot: swap placeholder for real asset when path is provided
  const existingAsset = mediaSlot.querySelector('img, video');
  if (existingAsset) existingAsset.remove();

  if (opts.mediaPath) {
    placeholder.hidden = true;
    const isVideo = /\.(mp4|webm|ogg)$/i.test(opts.mediaPath);
    const asset   = document.createElement(isVideo ? 'video' : 'img');
    asset.src     = opts.mediaPath;
    if (isVideo) { asset.autoplay = true; asset.muted = true; asset.loop = false; }
    asset.style.cssText = 'width:100%;display:block;';
    mediaSlot.insertBefore(asset, placeholder);
  } else {
    placeholder.hidden = false;
    placeholder.textContent = `[${(opts.type ?? 'event').toUpperCase()}]`;
  }

  overlay.hidden = false;
  overlay.classList.add('anim-fade-in');

  if (opts.autoDismiss > 0) {
    setTimeout(dismissAnim, opts.autoDismiss);
  }
}

// Expose to window for inline onclick in index.html
window.dismissAnim = dismissAnim;
