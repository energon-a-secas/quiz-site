/**
 * Shared pieces the round and the games render: the keycap, the progress
 * track, the streak ring, the feedback panel and the live regions.
 * llms.txt pins keycap(n) here. Everything is built with h(), so nothing a set
 * document carries is ever parsed as markup.
 */

import { h, append, clear, srOnly, reducedMotion } from './utils.js';
import { str } from './strings.js';

/**
 * An ordered keycap: a separate 28px box beside the option, never text in it.
 * The button it sits in carries data-key="n" and aria-keyshortcuts="n"; this
 * box is aria-hidden so the option's accessible name stays its text only.
 * Pass { sr: lang } to add the visually hidden "Press n" (the library does).
 */
export function keycap(n, { sr = null, wide = false } = {}) {
  const cap = h('span', { class: wide ? 'q-keycap q-keycap--wide' : 'q-keycap', 'aria-hidden': 'true', text: String(n) });
  if (!sr) return cap;
  return h('span', { class: 'q-keycap-wrap' }, [cap, srOnly(str('keycap.sr', sr, { key: n }))]);
}

/** Focus the first option a keyboard user can reach, if there is one. */
export function focusFirstOption(host) {
  const first = host.querySelector('button[data-key]:not([disabled])') || host.querySelector('button:not([disabled])');
  if (first) first.focus({ preventScroll: true });
  return first;
}

/**
 * The round's history as a track: one 4px segment per item, correct in
 * accent, missed in danger at 60%, unplayed in surface-2. role="img" with the
 * progress string as its label. replay: true staggers the segments 40ms apart.
 */
export function progressTrack({ results, total, label, replay = false }) {
  const track = h('div', { class: replay ? 'q-track q-track--replay' : 'q-track', role: 'img', 'aria-label': label });
  for (let i = 0; i < total; i += 1) {
    const r = results[i];
    const cls = r ? (r.correct ? 'q-track__seg is-hit' : 'q-track__seg is-miss') : 'q-track__seg';
    track.appendChild(h('span', { class: cls, style: { '--i': i } }));
  }
  return track;
}

/** The streak mark, an 8px accent dot, hidden until 3. pulse: true scales it once (5, 10, 15...). */
export function streakBadge(n, lang, pulse = false) {
  const el = h('span', { class: 'q-streak', hidden: n < 3, 'aria-hidden': 'true' }, [
    h('i', { class: pulse ? 'q-streak__ring is-pulse' : 'q-streak__ring' }),
    str('streak.count', lang, { n }),
  ]);
  return el;
}

/**
 * The feedback panel after a wrong answer. misses is every wrong answer since
 * the mount (pairs lists the whole board): each gives the expected answer and
 * the game's why ({ text, node, showWhat }). A why whose node already shows
 * the expected answer (order's marked line) passes showWhat: false and the
 * "The answer was" line is skipped rather than said twice. Focus lands on
 * the title.
 *
 * A miss the clock caused (timedOut) opens with "Time ran out" above the
 * game's own why: the panel's title says "Not quite" about a pick, and a
 * learner who made none is owed the reason the item was scored at all.
 */
export function feedbackPanel({ lang, misses, onContinue }) {
  const title = h('h2', { class: 'q-feedback__title', id: 'q-feedback-title', tabindex: '-1', text: str('feedback.wrong', lang) });
  const panel = h('section', { class: 'q-feedback', 'aria-labelledby': 'q-feedback-title' }, [title]);
  misses.forEach((m) => {
    const why = m.why || {};
    const node = why.node instanceof Node ? why.node : null;
    append(panel, h('div', { class: 'q-miss' }, [
      m.timedOut ? h('p', { class: 'q-miss__timeout', text: str('feedback.timeout', lang) }) : null,
      node && why.showWhat === false ? null : h('p', { class: 'q-miss__what' }, [
        h('span', { class: 'q-miss__label', text: str('feedback.answerWas', lang) }),
        ' ',
        h('strong', { class: 'q-miss__expected', text: m.expected }),
      ]),
      h('div', { class: 'q-miss__why' }, node || h('p', { text: why.text || '' })),
    ]));
  });
  const btn = h('button', {
    type: 'button', class: 'btn btn--primary q-feedback__continue', 'aria-keyshortcuts': 'Space Enter',
    text: str('feedback.continue', lang), on: { click: onContinue },
  });
  append(panel, btn);
  return { panel, title, btn };
}

/** The polite live region: progress per item, "Right", and api.say(). */
export function live(text) {
  const el = document.getElementById('quiz-progress');
  if (el) { clear(el); el.textContent = text; }
}

/** The assertive live region: "Not quite" and every error. */
export function verdict(text) {
  const el = document.getElementById('quiz-verdict');
  if (el) { clear(el); el.textContent = text; }
}

/** The leave/enter durations the round animates with, honouring reduced motion. */
export function motion() {
  const reduce = reducedMotion();
  return { reduce, leave: reduce ? 100 : 150, enter: reduce ? 100 : 200, dwell: reduce ? 300 : 600 };
}
