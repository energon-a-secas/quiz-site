/**
 * The round clock: opt-in, escapable, and the only thing in this engine that
 * measures a budget rather than an elapsed time.
 *
 * `ms` is recorded on every round and raced on none of them unless somebody
 * asked (llms.txt, "Timed rounds"). WCAG 2.2.1 wants a timing that can be
 * turned off, adjusted or extended before it starts, so the seconds are a
 * library preference set before the round, `?timed=` is a host's choice for
 * its own frame, and "Turn off the clock" sits on the round itself, embed
 * included. Once off, off wins: prefs.timed === false outranks a later URL and
 * a later host, which is why the resolution below reads it first.
 *
 * Modules never time anything (llms.txt, the game module interface). This file
 * owns the bar, the drain and the expiry; js/round.js owns what a timeout
 * means to a round, and calls the module's expire() when one happens.
 */

import { h } from './utils.js';
import { str } from './strings.js';

export const TIMED_MIN = 3;
export const TIMED_MAX = 30;
export const TIMED_DEFAULT = 8;

/**
 * `?timed=` as seconds, or null when the round is untimed. timed=1 is the
 * default budget; timed=<N> is N seconds, 3 to 30. Anything else is discarded
 * exactly as a bad limit is, so a typo never silently starts a clock.
 */
export function parseTimedParam(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (n === 1) return TIMED_DEFAULT;
  return n >= TIMED_MIN && n <= TIMED_MAX ? n : null;
}

/** The library's number input, held inside the range prefs may carry. */
export function clampSeconds(n) {
  if (!Number.isFinite(n)) return TIMED_DEFAULT;
  return Math.min(TIMED_MAX, Math.max(TIMED_MIN, Math.round(n)));
}

/**
 * The budget for one round in seconds, or null when it is untimed.
 *
 * Order, and each line is a rule from llms.txt:
 *   1. the clock was turned off: nothing starts it again but the library
 *   2. the URL asked, which is how a host times its own frame
 *   3. standalone only, the library toggle's saved seconds
 * An embed therefore times only when its host wrote timed=, whatever this
 * browser has saved from playing standalone on the same origin.
 */
export function resolveTimedSeconds({ cfg, prefs, embed }) {
  if (prefs && prefs.timed === false) return null;
  if (cfg && Number.isInteger(cfg.timed)) return cfg.timed;
  if (embed) return null;
  return prefs && Number.isInteger(prefs.timed) ? prefs.timed : null;
}

/**
 * The bar and its escape control. 2px under the progress track, draining by
 * scaleX over the budget, --danger for the last second: one swap, no flash,
 * no pulse, no sound. The bar is aria-hidden and never speaks; the item's
 * announcement says the seconds once (DESIGN.md 8) and a timeout speaks in
 * #quiz-verdict. Under reduced motion the fill steps once a second instead of
 * transitioning, so nothing on screen animates continuously.
 *
 * @param {object} o
 * @param {number} o.seconds      the budget, already validated
 * @param {'en'|'es'} o.lang
 * @param {boolean} [o.reduce]    prefers-reduced-motion
 * @param {() => void} o.onExpire the budget ran out with the item unanswered
 * @param {() => void} o.onOff    the learner turned the clock off
 */
export function createClock({ seconds, lang, reduce = false, onExpire, onOff }) {
  const budgetMs = Math.max(1, Math.round(seconds * 1000));
  const fill = h('i', { class: 'q-clock__fill' });
  const bar = h('div', { class: 'q-clock', 'aria-hidden': 'true' }, [fill]);
  const off = h('button', {
    type: 'button', class: 'btn btn--ghost btn--sm q-clock__off', text: str('timed.off', lang),
    on: { click: () => { if (typeof onOff === 'function') onOff(); } },
  });
  const row = h('div', { class: 'q-clock-row' }, [bar, off]);
  let expireT = null;
  let lastT = null;
  let stepT = null;
  let running = false;

  const paint = (frac) => { fill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`; };

  function stop() {
    running = false;
    clearTimeout(expireT); expireT = null;
    clearTimeout(lastT); lastT = null;
    clearInterval(stepT); stepT = null;
    bar.classList.remove('is-last');
  }

  function start() {
    stop();
    running = true;
    fill.style.transition = 'none';
    paint(1);
    lastT = setTimeout(() => { if (running) bar.classList.add('is-last'); }, Math.max(0, budgetMs - 1000));
    expireT = setTimeout(() => {
      stop();
      paint(0);
      if (typeof onExpire === 'function') onExpire();
    }, budgetMs);
    if (reduce) {
      let left = seconds;
      stepT = setInterval(() => { left -= 1; paint(left / seconds); }, 1000);
      return;
    }
    // Two frames: the browser has to paint scaleX(1) before the drain starts,
    // or the transition has nothing to run from and the bar jumps to empty.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!running) return;
      fill.style.transition = `transform ${budgetMs}ms linear`;
      paint(0);
    }));
  }

  return {
    row,
    budgetMs,
    start,
    stop,
    /** The learner turned it off: the bar goes, and nothing replaces it. */
    destroy() { stop(); row.remove(); },
  };
}
