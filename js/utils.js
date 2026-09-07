/**
 * Small shared helpers: a DOM builder, escaping, a seedable random source and
 * a few numbers. No state, no DOM writes beyond what h() is asked to build.
 */

const _els = {};

/** Element lookup by id, cached only while the node is still in the document. */
export function $(id) {
  const cached = _els[id];
  if (cached && cached.isConnected) return cached;
  const found = document.getElementById(id);
  _els[id] = found;
  return found;
}

/** Escape HTML special characters, for the rare string that is built as markup. */
export function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build an element. Attributes are set with setAttribute, except the handful
 * that are properties or conveniences:
 *   class, text, hidden, dataset: {...}, on: { click: fn }, style: {...}
 * Children may be nodes, strings, arrays, or null. Strings become text nodes,
 * so nothing passed here is ever parsed as markup.
 */
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'hidden') el.hidden = !!v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style') {
      // A custom property (--i) is not a style property; only setProperty reaches it.
      Object.entries(v).forEach(([prop, val]) => {
        if (prop.startsWith('--')) el.style.setProperty(prop, String(val));
        else el.style[prop] = val;
      });
    }
    else if (k === 'on') Object.entries(v).forEach(([ev, fn]) => el.addEventListener(ev, fn));
    else if (k === 'disabled') el.disabled = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}

export function clear(el) {
  if (el) el.textContent = '';
  return el;
}

/** A visually hidden span, for screen reader text beside a decorative box. */
export function srOnly(text) {
  return h('span', { class: 'sr-only', text });
}

/* ── Seeded randomness ──────────────────────────────────────────────
   A round is replayable by seed (llms.txt, ?seed=): the shuffle, the numeral
   window and the sound direction all draw from one stream, so the engine
   draws first and the game draws after, in mount order. */

/** cyrb53-style 32-bit hash of a string, for a seed word. */
export function hashSeed(text) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) ^ (h1 >>> 0);
}

/** mulberry32: a small, good enough generator returning [0, 1). */
export function rng(seed) {
  let a = hashSeed(seed) >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seed word for a round nobody asked to replay. */
export function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

/** Fisher-Yates over a copy, drawing from the given random source. */
export function shuffle(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function median(nums) {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Bytes a string takes as UTF-8. */
export function byteLength(text) {
  try {
    return new TextEncoder().encode(String(text)).length;
  } catch {
    return 0;
  }
}

/** Wait for the next frame, then one more, so a class change lands as a transition. */
export function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
