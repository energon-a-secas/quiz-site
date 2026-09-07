// Shared pieces for the four game modules: a DOM helper, the option button
// built around the engine's keycap, the verdict marks, a seeded shuffle, the
// clock, the live region announcements and the strings the games speak. The
// engine, the api and the feedback panel belong to other modules; this file
// builds only what the games need and llms.txt has not placed elsewhere. The
// keycap is the one piece llms.txt pins to js/ui.js, so it is imported from
// there and not copied.
//
// Every class here is prefixed qz- and every colour is a base.css token, or
// the scaffold's --danger, --control-height, --keycap, --tile and --ease-out.
// Nothing is redeclared. The strings are js/strings.js entries picked by key
// below, so DESIGN.md section 12 is the one table; api.t resolves values, not
// keys, and a module renders the same in any host that implements the api,
// the engine or a bare test harness alike.

import { keycap } from '../ui.js';
import { STRINGS } from '../strings.js';

export { keycap };

/**
 * The strings the games speak, as bilingual values keyed the way the modules
 * name them. They are js/strings.js entries and not copies: api.t resolves
 * values, not keys, so a module renders the same in any host that implements
 * the api, and the table in DESIGN.md section 12 stays the one list.
 */
const K = (key) => STRINGS[key];
export const S = {
  beatsName: K('game.beats.name'),
  beatsDescribe: K('game.beats.describe'),
  soundName: K('game.sound.name'),
  soundDescribe: K('game.sound.describe'),
  toSound: K('sound.toSound'),
  toKana: K('sound.toKana'),
  pairsName: K('game.pairs.name'),
  pairsDescribe: K('game.pairs.describe'),
  pairsPrompt: K('pairs.prompt'),
  pairsReading: K('pairs.reading'),
  orderName: K('game.order.name'),
  orderDescribe: K('game.order.describe'),
  orderUndo: K('order.undo'),
  orderLine: K('order.line'),
  orderBank: K('order.bank'),
  orderGloss: K('order.gloss'),
  feedbackBeats: K('feedback.beats'),
  feedbackSound: K('feedback.sound'),
  // ん is the one kana with no column. The table's string would read "null
  // column", so it gets a reduced line of its own.
  feedbackSoundAlone: K('feedback.soundAlone'),
  feedbackPairs: K('feedback.pairs'),
  feedbackOrder: K('feedback.order'),
  liveCorrect: K('live.correct'),
  liveWrong: K('live.wrong'),
  keycapSr: K('keycap.sr'),
};

/* ── DOM ─────────────────────────────────────────────────────── */

/** Build an element. attrs: class, text, dataset, on<event>, anything else is an attribute. */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = String(v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

let uidCounter = 0;
export function uid(prefix = 'qz') {
  uidCounter += 1;
  return `${prefix}-${uidCounter}`;
}

/**
 * Install a stylesheet once per id. Modules own their own CSS this way. The
 * base sheet always goes in first: a game's rule that overrides one of the
 * base rules at equal specificity (.qz-tiles over .qz-options) only wins by
 * coming later in the document.
 */
export function addStyle(id, css) {
  if (id !== 'base') ensureBaseStyle();
  if (document.querySelector(`style[data-qz="${id}"]`)) return;
  document.head.append(el('style', { 'data-qz': id, text: css }));
}

export function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** True when a key event comes from a field, so a game key must not fire. */
export function isTyping(e) {
  const t = e.target;
  if (!t || !t.tagName) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable === true;
}

/** True when the visitor switched single-key shortcuts off in NeoKeys (WCAG 2.1.4). */
export function shortcutsOff() {
  const nk = typeof window !== 'undefined' ? window.NeoKeys : null;
  return !!(nk && typeof nk.isDisabled === 'function' && nk.isDisabled());
}

/* ── Keycaps and options ─────────────────────────────────────── */

/**
 * One option. The button carries data-key (the engine clicks it on that digit)
 * and aria-keyshortcuts; its accessible name is the label alone, because the
 * keycap from js/ui.js is aria-hidden. cap: false renders no keycap (beats,
 * where the numeral is the key).
 */
export function option({ label, key, cap = true, cls = '' }) {
  const btn = el('button', {
    type: 'button',
    class: `qz-opt ${cls}`.trim(),
    'data-key': key,
    'aria-keyshortcuts': key,
  });
  if (cap) btn.append(keycap(key));
  btn.append(el('span', { class: 'qz-opt__label', text: label }));
  return btn;
}

/** The keycap box inside an option, or null when the option renders none. */
export function capOf(btn) {
  return btn.querySelector('.q-keycap');
}

/** Move the digit from one button to another without renumbering anything. */
export function setKey(btn, key) {
  if (key === null) {
    btn.removeAttribute('data-key');
    btn.removeAttribute('aria-keyshortcuts');
  } else {
    btn.setAttribute('data-key', key);
    btn.setAttribute('aria-keyshortcuts', key);
  }
}

/** The prompt block: the thing asked, an optional sub line, the question line. */
export function prompt({ main, sub, question, id, mainClass = '' }) {
  return el('div', { class: 'qz-prompt' }, [
    main === undefined ? null : el('div', { class: `qz-prompt__main ${mainClass}`.trim(), text: main }),
    sub ? el('div', { class: 'qz-prompt__sub', text: sub }) : null,
    el('p', { class: 'qz-prompt__q', id, text: question }),
  ]);
}

export function optionsGroup(labelledBy, cls = '') {
  return el('div', { class: `qz-options ${cls}`.trim(), role: 'group', 'aria-labelledby': labelledBy });
}

/* ── Verdict marks ───────────────────────────────────────────── */

const SVG = 'http://www.w3.org/2000/svg';

/** A 20px check that draws itself through stroke-dashoffset. */
export function check() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'qz-check');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', 'M4 10.5 8.5 15 16 5.5');
  svg.append(path);
  return svg;
}

/** The chosen option was right: fill, and the check draws. */
export function markCorrect(btn) {
  btn.classList.add('is-correct');
  btn.append(check());
}

/** The chosen option was wrong: a 2px danger ring and one nudge, text unchanged. */
export function markWrong(btn) {
  btn.classList.add('is-wrong');
}

/** After a miss the expected option fills, without a check. */
export function markExpected(btn) {
  btn.classList.add('is-correct');
}

/**
 * Disable every option except the chosen and the expected. The engine may
 * have dispatched a digit to an option that was not the focused one, and a
 * focused button that becomes disabled drops focus to body, so focus lands
 * on the chosen option (keep[0]) whenever it was inside the group.
 */
export function settle(group, keep) {
  group.classList.add('is-settled');
  const hadFocus = group.contains(document.activeElement);
  for (const b of group.querySelectorAll('button')) {
    if (keep.includes(b)) continue;
    b.disabled = true;
  }
  if (hadFocus && keep[0] && document.activeElement !== keep[0]) keep[0].focus({ preventScroll: true });
}

/* ── Seeds and shuffles ──────────────────────────────────────── */

function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 over a string seed. Same seed, same sequence, so a host can replay a round. */
export function rng(seed) {
  let a = hash32(String(seed)) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SALT = Math.random().toString(36).slice(2);

/** A generator for one item. round.seed is optional; without it every load differs. */
export function itemRng(round, item) {
  return rng(`${round.seed === undefined || round.seed === null ? SALT : round.seed}|${item.id}`);
}

/* ── Clock ───────────────────────────────────────────────────── */

/** ms from first paint to the commit. reset() restarts it (pairs, after a lock). */
export function clock() {
  let t0 = performance.now();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => { t0 = performance.now(); });
  }
  return {
    read() { return Math.max(0, Math.round(performance.now() - t0)); },
    reset() { t0 = performance.now(); },
  };
}

/* ── Live regions ────────────────────────────────────────────── */

/**
 * Speak the verdict, unless the host already has. The engine writes
 * live.correct and live.wrong itself when api.answer() runs (DESIGN.md
 * section 8), so a module calls this after api.answer() and it fills only a
 * region the host left silent. The sentence is the same either way, so a
 * screen reader hears it once in the engine and once in a bare harness,
 * never twice. A correct answer goes to the polite region through api.say; a
 * wrong one to #quiz-verdict (assertive, role=alert) when the page has it.
 */
export function announce(api, round, { correct, n, expected }) {
  const total = round.items.length;
  if (correct) {
    const text = api.t(S.liveCorrect, { n, total });
    const polite = document.getElementById('quiz-progress');
    if (polite && polite.textContent === text) return;
    api.say(text);
    return;
  }
  const text = api.t(S.liveWrong, { expected });
  const alertEl = document.getElementById('quiz-verdict');
  if (!alertEl) { api.say(text); return; }
  if (alertEl.textContent === text) return;
  alertEl.textContent = '';
  alertEl.textContent = text;
}

/* ── Why node ────────────────────────────────────────────────── */

export function why(children) {
  return el('div', { class: 'qz-why' }, children);
}

export function whyLine(text, cls = '') {
  return el('p', { class: `qz-why__line ${cls}`.trim(), text });
}

/** The section every game mounts into host. */
export function gameRoot(id) {
  ensureBaseStyle();
  return el('section', { class: `qz-game qz-game--${id}`, 'data-game': id });
}

/* ── Base stylesheet ─────────────────────────────────────────── */

// The item's entry and exit motion belongs to the engine's host (DESIGN.md
// section 7, "Next item"), so nothing here animates .qz-game itself; a
// harness that wants the rise adds it to its own host.
function ensureBaseStyle() {
  if (document.querySelector('style[data-qz="base"]')) return;
  document.head.append(el('style', { 'data-qz': 'base', text: `
.qz-game { display: flex; flex-direction: column; gap: var(--space-6); }
@keyframes qz-fade { from { opacity: 0; } to { opacity: 1; } }
.qz-prompt { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-2); }
.qz-prompt__main { font-weight: 500; color: var(--text-primary); line-height: 1.2; overflow-wrap: anywhere; }
.qz-prompt__main--glyph { font-size: 4rem; line-height: 1; }
.qz-prompt__main--word { font-size: 2.25rem; }
.qz-prompt__sub { font-size: var(--text-base); color: var(--text-secondary); }
.qz-prompt__q { font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary); margin-top: var(--space-2); }
.qz-options { display: grid; gap: var(--space-3); }
.qz-options--2col { grid-template-columns: 1fr 1fr; }
.qz-opt { position: relative; display: grid; grid-template-columns: var(--keycap, 28px) 1fr; align-items: center; gap: var(--space-3);
  min-height: var(--control-height); padding: var(--space-2) var(--space-3); background: var(--surface-1);
  border: 1px solid var(--border); border-radius: var(--radius); color: var(--text-primary); font: inherit;
  font-size: var(--text-lg); font-weight: 500; line-height: 1.3; text-align: left; cursor: pointer;
  -webkit-tap-highlight-color: transparent; overflow-wrap: anywhere;
  transition: background-color var(--dur-fast), border-color var(--dur-fast), box-shadow var(--dur-fast), opacity var(--dur), transform var(--dur-fast); }
.qz-opt--xl { font-size: var(--text-xl); }
.qz-opt--bare { grid-template-columns: 1fr; }
.qz-opt:hover:not(:disabled) { background: var(--surface-2); }
.qz-opt:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: 2px; }
.qz-opt:active:not(:disabled) { transform: translateY(1px); }
.qz-opt:disabled { opacity: .6; cursor: default; }
.qz-opt.is-correct, .qz-opt.is-correct:hover { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.qz-opt.is-correct .q-keycap { background: transparent; border-color: currentColor; color: inherit; opacity: .75; }
.qz-opt.is-wrong { border-color: var(--danger); box-shadow: inset 0 0 0 1px var(--danger); animation: qz-nudge 120ms var(--ease-out); }
@keyframes qz-nudge { 0% { transform: none; } 50% { transform: translateX(4px); } 100% { transform: none; } }
.qz-opt.is-correct .qz-opt__label { padding-right: 28px; }
.qz-opt .q-keycap.is-idle { visibility: hidden; }
.qz-check { position: absolute; right: var(--space-3); top: 50%; width: 20px; height: 20px; translate: 0 -50%; }
.qz-check path { stroke: currentColor; stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 19; stroke-dashoffset: 19; animation: qz-draw 200ms var(--ease-out) 150ms forwards; }
@keyframes qz-draw { to { stroke-dashoffset: 0; } }
.qz-why { display: flex; flex-direction: column; gap: var(--space-3); font-size: var(--text-base); line-height: 1.5; max-width: 65ch; }
.qz-why__line { color: var(--text-secondary); }
.qz-why__line--rule { color: var(--text-primary); }
.qz-why__label { font-size: var(--text-xs); font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--text-muted); }
@media (max-width: 480px) {
  .qz-options--2col { grid-template-columns: 1fr; }
}
@media (max-width: 360px) {
  .qz-prompt__main--glyph { font-size: 3rem; }
  .qz-prompt__main--word { font-size: 1.75rem; }
}
@media (prefers-reduced-motion: reduce) {
  .qz-opt.is-wrong { animation: qz-fade 100ms; }
  .qz-opt { transition-duration: 100ms; }
}
` }));
}
