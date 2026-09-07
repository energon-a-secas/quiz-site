/**
 * The screens around the round: library, skeleton, error, results, and the
 * licence attribution. The round itself is js/round.js.
 */

import { state, ROUND_SIZES, lastScore, savePrefs } from './state.js';
import { str, t, hadFallback } from './strings.js';
import { h, append, clear } from './utils.js';
import { progressTrack, verdict, live } from './ui.js';
import { GAME_IDS } from './games/index.js';
import { openHref } from './embed.js';

/** The set each library row has picked, so a re-render keeps the choice. */
const choice = {};

/** The header subtitle, the footer note and the document language. */
export function relabelChrome(lang) {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-ui]').forEach((el) => { el.textContent = str(el.dataset.ui, lang); });
}

/**
 * The honesty line (CONTRACTS convention 2): one sentence, once per screen,
 * when a Spanish reader was shown something in English. Hidden otherwise,
 * and never shown to an English reader, who is reading the fallback itself.
 */
export function refreshLangNote() {
  const note = document.getElementById('quiz-lang-note');
  if (!note) return;
  note.hidden = !(state.lang !== 'en' && hadFallback());
}

/** A skeleton of the round header and four option rows while a set fetches. */
export function renderSkeleton(root) {
  clear(root);
  live(str('live.loading', state.lang));
  append(root, h('div', { class: 'q-skeleton', 'aria-busy': 'true', 'aria-label': str('live.loading', state.lang) }, [
    h('div', { class: 'q-skeleton__head' }, [h('span', { class: 'skeleton' }), h('span', { class: 'skeleton' })]),
    h('div', { class: 'q-skeleton__prompt skeleton' }),
    ...[0, 1, 2, 3].map(() => h('div', { class: 'q-skeleton__row skeleton' })),
  ]));
}

function gameOrder() {
  const last = state.prefs.lastGame;
  return GAME_IDS.includes(last) ? [last, ...GAME_IDS.filter((g) => g !== last)] : GAME_IDS.slice();
}

function metaLine(game, entry, lang) {
  if (!entry) return str('library.noSets', lang);
  const parts = [];
  if (Number.isFinite(entry.count)) parts.push(str('library.items', lang, { n: entry.count }));
  if (entry.licence?.spdx) parts.push(entry.licence.spdx);
  const score = lastScore(game, entry.id);
  parts.push(score?.last ? str('library.last', lang, { correct: score.last.correct, total: score.last.total }) : str('library.unplayed', lang));
  return parts.join(' · ');
}

function gameRow(game, lang, onPlay) {
  const sets = state.builtin.filter((s) => s.game === game);
  const picked = sets.find((s) => s.id === choice[game]) || sets[0] || null;
  if (picked) choice[game] = picked.id;
  const meta = h('p', { class: 'q-game__meta', text: metaLine(game, picked, lang) });
  const selectId = `q-set-${game}`;
  const select = h('select', { id: selectId, class: 'q-select', disabled: !sets.length }, sets.map((s) => h('option', {
    value: s.id, selected: s.id === picked?.id,
    text: Number.isFinite(s.count) ? `${t(s.name, lang)} · ${str('library.items', lang, { n: s.count })}` : t(s.name, lang),
  })));
  select.addEventListener('change', () => {
    choice[game] = select.value;
    meta.textContent = metaLine(game, sets.find((s) => s.id === select.value), lang);
  });
  const play = h('button', {
    type: 'button', class: 'btn btn--primary q-game__play', disabled: !picked, text: str('library.play', lang),
    on: { click: () => picked && onPlay({ game, set: choice[game], limit: state.prefs.round }) },
  });
  return h('li', { class: 'q-game', dataset: { game } }, [
    h('div', { class: 'q-game__info' }, [
      h('h3', { class: 'q-game__name', text: str(`game.${game}.name`, lang) }),
      h('p', { class: 'q-game__describe', text: str(`game.${game}.describe`, lang) }),
    ]),
    h('div', { class: 'q-game__controls' }, [
      h('label', { class: 'q-field', for: selectId }, [h('span', { text: str('library.set', lang) }), select]),
      meta,
      play,
    ]),
  ]);
}

/**
 * The round length is one preference for every game, so it is one control,
 * under the title, and not a copy per row pretending to be local.
 */
function roundSizes(lang, rerender) {
  return h('div', { class: 'q-sizes', role: 'group', 'aria-label': str('library.roundLabel', lang) }, [
    h('span', { class: 'q-sizes__label', id: 'q-sizes-label', text: str('library.roundLabel', lang) }),
    ...ROUND_SIZES.map((n) => h('button', {
      type: 'button', class: 'btn btn--ghost btn--sm', 'aria-pressed': String(state.prefs.round === n), text: String(n),
      'aria-label': str('library.round', lang, { n }),
      on: { click: () => { state.prefs.round = n; savePrefs(); rerender(); } },
    })),
  ]);
}

/**
 * The home screen: the four games as a list, the last played first. The
 * header kit owns the page's h1, so the title here is an h2. The keys are not
 * repeated per row: the ? sheet lists them once.
 */
export function renderLibrary(root, { onPlay }) {
  const lang = state.lang;
  const paint = () => {
    clear(root);
    append(root, h('section', { class: 'q-library', 'aria-labelledby': 'q-library-title' }, [
      h('div', { class: 'q-library__head' }, [
        h('h2', { class: 'q-library__title', id: 'q-library-title', text: str('library.title', lang) }),
        roundSizes(lang, paint),
      ]),
      h('ul', { class: 'q-games' }, gameOrder().map((g) => gameRow(g, lang, onPlay))),
    ]));
    refreshLangNote();
  };
  paint();
}

/** A named error in the surface. Never a blank. */
export function renderError(root, { key, vars = {}, detail = '' }) {
  const lang = state.lang;
  const message = str(key, lang, vars);
  clear(root);
  verdict(message);
  append(root, h('section', { class: 'q-error', 'aria-labelledby': 'q-error-title' }, [
    h('h2', { class: 'q-error__title', id: 'q-error-title', tabindex: '-1', text: str('error.title', lang) }),
    h('p', { class: 'q-error__message', text: message }),
    detail ? h('p', { class: 'q-error__detail', text: detail }) : null,
    state.embed ? null : h('a', { class: 'btn btn--ghost', href: './', text: str('error.library', lang) }),
  ]));
  root.querySelector('.q-error__title')?.focus();
}

/** What a miss row shows as its prompt, from the answer record or the item. */
function promptOf(game, item, rec) {
  if (rec.prompt) return String(rec.prompt);
  if (!item) return rec.itemId;
  if (game === 'beats') return item.kana;
  if (game === 'sound') return rec.expected === item.kana ? item.sound : item.kana;
  if (game === 'pairs') return item.left;
  // The learner's line is the prompt they answered; the gloss is the why, not the prompt.
  if (game === 'order') return rec.chosen || item.line;
  return rec.itemId;
}

/**
 * The results screen. Focus lands on the title. partial: the round was left
 * before its end (embed only, standalone goes back to the library): the title
 * says where it stopped and the score is out of what was answered, while the
 * track still shows the unplayed segments.
 */
export function renderResults(root, summary, { onAgain, onChange, partial = false }) {
  const lang = state.lang;
  const perfect = !partial && summary.total > 0 && summary.correct === summary.total;
  const misses = summary.results.filter((r) => !r.correct);
  const byId = new Map(summary.items.map((it) => [it.id, it]));
  const label = str('progress', lang, { n: summary.answered, total: summary.total });
  const title = partial
    ? str('results.partial', lang, { n: summary.answered, total: summary.total })
    : str(perfect ? 'results.perfect' : 'results.title', lang);
  clear(root);
  append(root, h('section', { class: 'q-results', 'aria-labelledby': 'q-results-title' }, [
    h('h2', { class: 'q-results__title', id: 'q-results-title', tabindex: '-1', text: title }),
    h('p', { class: 'q-results__score', text: str('results.score', lang, { correct: summary.correct, total: partial ? summary.answered : summary.total }) }),
    h('p', { class: 'q-results__meta' }, [
      str('results.median', lang, { s: (summary.medianMs / 1000).toFixed(1) }),
      ' · ',
      str('results.streak', lang, { n: summary.bestStreak }),
    ]),
    progressTrack({ results: summary.results, total: summary.total, label, replay: true }),
    misses.length ? h('h3', { class: 'q-results__misses', text: str('results.misses', lang) }) : null,
    misses.length ? h('ul', { class: 'q-miss-list' }, misses.map((r) => h('li', { class: 'q-miss-list__row' }, [
      h('span', { class: 'q-miss-list__prompt', text: promptOf(summary.game, byId.get(r.itemId), r) }),
      h('span', { class: 'q-miss-list__expected', text: r.expected }),
      h('span', { class: 'q-miss-list__why', text: r.why?.text || '' }),
    ]))) : null,
    h('div', { class: 'q-results__actions' }, [
      h('button', { type: 'button', class: 'btn btn--primary', text: str('results.again', lang), on: { click: onAgain } }),
      state.embed
        ? h('a', { class: 'btn btn--ghost', href: openHref(), target: '_blank', rel: 'noopener noreferrer', text: str('embed.open', lang) })
        : h('button', { type: 'button', class: 'btn btn--ghost', text: str('results.change', lang), on: { click: onChange } }),
    ]),
  ]));
  refreshLangNote();
  root.querySelector('.q-results__title')?.focus();
}

/**
 * The licence attribution, only when the set says screen: "required". One
 * line stays visible on every screen that shows the set: the attribution's
 * first sentence, in the licensor's own words. The rest of it and the source
 * link open from that line, the footer kit's own disclaimer rule, so the
 * acknowledgement is on screen without being the largest block of text
 * beside the prompt.
 */
export function renderAttribution(set) {
  const holder = document.getElementById('quiz-attrib');
  if (!holder) return;
  clear(holder);
  const lic = set?.licence;
  if (!lic || lic.screen !== 'required' || !lic.attribution) { holder.hidden = true; return; }
  const safe = typeof lic.source === 'string' && /^https?:\/\//i.test(lic.source) ? lic.source : null;
  const full = String(lic.attribution).trim();
  const cut = full.search(/[.!?](\s|$)/);
  const first = cut > 0 ? full.slice(0, cut + 1) : full;
  const rest = cut > 0 ? full.slice(cut + 1).trim() : '';
  if (!rest && !safe) {
    append(holder, h('p', { class: 'q-attrib__line', text: full }));
  } else {
    append(holder, h('details', { class: 'q-attrib__details' }, [
      h('summary', { class: 'q-attrib__line' }, [
        h('span', { class: 'q-attrib__first', text: first }),
        h('span', { class: 'q-attrib__more', text: str('attrib.more', state.lang) }),
      ]),
      h('p', { class: 'q-attrib__body' }, [
        rest || null,
        rest && safe ? ' ' : null,
        safe ? h('a', { href: safe, target: '_blank', rel: 'noopener noreferrer', text: str('attrib.source', state.lang) }) : null,
      ]),
    ]));
  }
  holder.hidden = false;
}
