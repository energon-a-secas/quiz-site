/**
 * The round runner: shuffles the set by seed, mounts one game item at a time,
 * keeps score and streak, shows the feedback panel for every wrong answer
 * since the mount, advances, and ends with a summary. Games never advance
 * themselves; they call api.answer() and api.next() and nothing else.
 */

import { str, t } from './strings.js';
import { h, clear, rng, shuffle, median, append } from './utils.js';
import { post, emitResize } from './embed.js';
import {
  keycap, feedbackPanel, progressTrack, streakBadge, focusFirstOption, live, verdict, motion,
} from './ui.js';
import { createClock } from './clock.js';

/**
 * @param {object} o
 * @param {object} o.set        the validated set document
 * @param {string} o.setId      its scoring id (namespaced when fetched)
 * @param {object[]} [o.items]  the items ?filter= kept; the whole set by default
 * @param {object} o.game       the loaded game module
 * @param {number} o.limit      items per round, already clamped
 * @param {string} o.seed
 * @param {'en'|'es'} o.lang
 * @param {boolean} o.embed
 * @param {string} o.skill
 * @param {string} [o.filterLabel] the filter in words, beside the game name
 * @param {number|null} [o.timedSeconds] the budget per item, null when untimed
 * @param {() => void} [o.onTimedOff] the learner turned the clock off mid-round
 * @param {HTMLElement} o.root  the surface, emptied here
 * @param {(summary: object) => void} o.onEnd
 * @param {(summary: object) => void} o.onLeave
 */
export function createRound(o) {
  const {
    set, setId, game, limit, seed, lang, embed, skill, filterLabel = '',
    timedSeconds = null, onTimedOff, root, onEnd, onLeave,
  } = o;
  const random = rng(seed);
  // The round is shuffled out of what ?filter= kept; the pool behind it is
  // every item of the set, for the distractors and the sound game's row strip,
  // which neither a round of ten nor a round on one row can supply on its own.
  const pool = set.items;
  const source = Array.isArray(o.items) && o.items.length ? o.items : pool;
  const items = shuffle(source, random).slice(0, limit);
  const total = items.length;
  const round = { items, index: 0, lang, embed, seed, rng: random, pool, set };
  const results = [];
  let cursor = 0;
  let sinceMount = [];
  let handle = null;
  let finished = false;
  let alive = true;
  let lastAt = 0;
  let streak = 0;
  let bestStreak = 0;
  let panel = null;
  let timer = null;
  // The clock, when the round has one (js/clock.js decides that, before this).
  // budgetMs follows it: null the moment the learner turns it off, which is
  // what every quiz:answer after that reports.
  const wasTimed = Number.isInteger(timedSeconds) && timedSeconds > 0;
  let clock = null;
  let budgetMs = null;
  let restartT = null;
  // True only while a module's expire() runs, so an answer it records is
  // marked as the timeout it is without the module knowing about clocks.
  let expiring = false;
  let advanceRequested = false;

  const gameName = t(game.name, lang);
  const head = h('header', { class: 'q-round-head' }, [
    h('span', { class: 'q-round-head__game' }, [
      gameName,
      // A filtered round says so where the game is named, and nowhere else:
      // the options, the feedback and the score key are the set's own.
      filterLabel ? h('span', { class: 'q-round-head__filter', text: ` · ${filterLabel}` }) : null,
    ]),
    h('span', { class: 'q-round-head__progress' }),
    h('span', { class: 'q-round-head__streak' }),
  ]);
  const trackSlot = h('div', { class: 'q-track-slot' });
  const clockSlot = h('div', { class: 'q-clock-slot', hidden: true });
  const quit = h('div', { class: 'q-quit', hidden: true, role: 'group', 'aria-labelledby': 'q-quit-title' });
  const host = h('div', { class: 'q-host', id: 'quiz-host' });
  const panelSlot = h('div', { class: 'q-panel-slot' });
  clear(root);
  append(root, [head, trackSlot, clockSlot, quit, host, panelSlot]);

  /** The item on screen: the one just answered while its panel is up, else the next. */
  function progressLabel() {
    const n = panel ? results.length : Math.min(results.length + 1, total);
    return str('progress', lang, { n: Math.max(1, n), total });
  }

  function updateHead(pulse = false) {
    head.querySelector('.q-round-head__progress').textContent = progressLabel();
    const s = head.querySelector('.q-round-head__streak');
    clear(s);
    s.appendChild(streakBadge(streak, lang, pulse));
    clear(trackSlot);
    trackSlot.appendChild(progressTrack({ results, total, label: progressLabel() }));
  }

  const api = {
    answer(v) {
      if (finished || !alive) return;
      // The item has been decided, so nothing is being raced any more. In
      // pairs the board is not done, so the clock is armed again below.
      stopClock();
      const now = performance.now();
      const ms = Number.isFinite(v?.ms) ? Math.max(0, Math.round(v.ms)) : Math.round(now - lastAt);
      lastAt = now;
      const rec = {
        itemId: String(v?.itemId ?? ''),
        correct: v?.correct === true,
        ms,
        chosen: String(v?.chosen ?? ''),
        expected: String(v?.expected ?? ''),
        why: v?.why && typeof v.why === 'object' ? v.why : null,
        prompt: v?.prompt ?? null,
        timedOut: expiring,
      };
      if (!rec.correct && !rec.why) console.warn(`[quiz] ${game.id}: a wrong answer for "${rec.itemId}" came with no why`);
      results.push(rec);
      sinceMount.push(rec);
      let pulse = false;
      if (rec.correct) {
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
        pulse = streak >= 5 && streak % 5 === 0;
        live(str('live.correct', lang, { n: results.length, total }));
      } else {
        streak = 0;
        verdict(str(rec.timedOut ? 'live.timeout' : 'live.wrong', lang, { expected: rec.expected }));
      }
      post('quiz:answer', {
        setId, game: game.id, itemId: rec.itemId, skill, correct: rec.correct, ms, chosen: rec.chosen, expected: rec.expected,
        timedOut: rec.timedOut, budgetMs,
      });
      updateHead(pulse);
      // pairs answers once per pair and calls next() only when the board is
      // full, so an answer that is not the last one arms the clock for the
      // next pair. Every other game calls next() in this same tick, which
      // cancels the restart before it can fire.
      //
      // A recorded answer is the signal because it is the only one the module
      // interface has: a pair that was missed first and locks later records
      // nothing at that lock, so its budget runs from the miss rather than
      // from the lock. That is a full budget per answerable unit either way,
      // and the alternative is a method modules would have to remember to
      // call, which is a silent clock the day one of them forgets.
      if (clock) restartT = setTimeout(startClock, 0);
    },
    next() {
      advanceRequested = true;
      stopClock();
      if (finished || !alive) return;
      const wrongs = sinceMount.filter((r) => !r.correct);
      if (wrongs.length) showPanel(wrongs);
      else timer = setTimeout(advance, motion().dwell);
    },
    say(text) { live(String(text ?? '')); },
    t: (value, vars) => t(value, lang, vars),
    keycap,
  };

  /* ── The clock ────────────────────────────────────────────────
     Opt-in, and stopped by everything that ends an item: an answer, the
     panel, the quit prompt, the end of the round. js/clock.js owns the bar
     and the countdown; what a timeout means to a round is here. */

  function stopClock() {
    clearTimeout(restartT);
    restartT = null;
    if (clock) clock.stop();
  }

  function startClock() {
    clearTimeout(restartT);
    restartT = null;
    if (clock && alive && !finished && !panel && quit.hidden) clock.start();
  }

  /**
   * The budget ran out with the item unanswered. The module marks its own
   * board and records the miss (llms.txt: expire() answers correct false with
   * chosen "", then next()); the engine only says that this answer was a
   * timeout, which is what puts "Time ran out" above the why and true on
   * quiz:answer's timedOut.
   */
  function onExpire() {
    if (finished || !alive || panel || !quit.hidden) return;
    advanceRequested = false;
    expiring = true;
    let expired = false;
    try {
      if (handle && typeof handle.expire === 'function') { handle.expire(); expired = true; }
    } catch (err) {
      console.error(`[quiz] js/games/${game.id}.js threw in expire()`, err);
    }
    if (!expired) {
      // A module that implements no expire() would leave the round on one
      // item forever, so the engine records the miss itself and says which
      // module owes an expire().
      console.warn(`[quiz] ${game.id}: mount() returned no expire(), so the engine recorded the timeout`);
      const item = items[round.index];
      api.answer({
        itemId: item ? item.id : '', correct: false, ms: budgetMs || 0, chosen: '', expected: '',
        why: { text: str('feedback.timeout', lang) },
      });
    }
    expiring = false;
    if (!advanceRequested) api.next();
  }

  /**
   * The WCAG 2.2.1 escape, mid-item and in an embed too: the bar goes, the
   * rest of the round is untimed, and the preference is written so no later
   * URL or host starts it again. Only the library toggle does.
   */
  function turnOffClock() {
    if (!clock) return;
    stopClock();
    clock.destroy();
    clock = null;
    budgetMs = null;
    clockSlot.hidden = true;
    if (typeof onTimedOff === 'function') onTimedOff();
    // The control that had focus has just left the document.
    if (panel) panel.querySelector('.q-feedback__title')?.focus();
    else focusFirstOption(host);
    emitResize();
  }

  function destroyHandle() {
    try { if (handle && typeof handle.destroy === 'function') handle.destroy(); } catch (err) { console.warn('[quiz] destroy()', err); }
    handle = null;
  }

  function mountItem() {
    round.index = cursor;
    sinceMount = [];
    clear(host);
    host.classList.remove('is-leaving');
    host.classList.add('is-entering');
    setTimeout(() => host.classList.remove('is-entering'), motion().enter + 50);
    updateHead();
    // The bar is aria-hidden, so the seconds are said once, here, with the
    // item (DESIGN.md 8). The clock itself never speaks again.
    const progress = str('live.progress', lang, { n: cursor + 1, total });
    live(budgetMs ? `${progress}. ${str('live.timed', lang, { s: Math.round(budgetMs / 1000) })}` : progress);
    lastAt = performance.now();
    try {
      handle = game.mount(host, round, api) || null;
    } catch (err) {
      console.error(`[quiz] js/games/${game.id}.js threw in mount()`, err);
      clear(host);
      host.appendChild(h('p', { class: 'q-error__detail', role: 'alert', text: `js/games/${game.id}.js: ${err && err.message ? err.message : err}` }));
    }
    focusFirstOption(host);
    startClock();
    emitResize();
  }

  function showPanel(wrongs) {
    removePanel();
    const built = feedbackPanel({
      lang,
      misses: wrongs.map((r) => ({ expected: r.expected, why: r.why, timedOut: r.timedOut })),
      onContinue: () => api_continue(),
    });
    panel = built.panel;
    panelSlot.appendChild(panel);
    updateHead();
    built.title.focus({ preventScroll: false });
    emitResize();
  }

  function removePanel() {
    if (panel) panel.remove();
    panel = null;
  }

  function api_continue() {
    if (!panel || finished) return;
    removePanel();
    advance();
  }

  function advance() {
    clearTimeout(timer);
    stopClock();
    if (finished || !alive) return;
    destroyHandle();
    // A mount that answered nothing still moves on, so a silent game cannot
    // loop the engine on one item forever.
    cursor = Math.max(results.length, cursor + 1);
    if (cursor >= total) { finish(); return; }
    host.classList.add('is-leaving');
    timer = setTimeout(mountItem, motion().leave);
  }

  function summary() {
    const correct = results.filter((r) => r.correct).length;
    return {
      setId, game: game.id, answered: results.length, correct, wrong: results.length - correct,
      ms: results.reduce((a, r) => a + r.ms, 0), medianMs: Math.round(median(results.map((r) => r.ms))),
      bestStreak, total, results: results.slice(), items,
      // A round that ran a clock at any point reads as timed on the results
      // screen, even when the learner turned it off part way: the seconds it
      // was played under are part of what those numbers mean.
      timed: wasTimed, timedOut: results.filter((r) => r.timedOut).length, budgetMs,
    };
  }

  function finish() {
    finished = true;
    stopClock();
    destroyHandle();
    removePanel();
    onEnd(summary());
  }

  function toggleQuit() {
    if (finished || !alive) return;
    if (!quit.hidden) { hideQuit(); return; }
    // Nobody is answering while the prompt is up, so the clock stops and the
    // item starts its budget again on "Keep playing". Esc is a way to pause,
    // which is what 2.2.1 asks of a timing that cannot simply be off.
    stopClock();
    clear(quit);
    append(quit, [
      h('p', { class: 'q-quit__title', id: 'q-quit-title', text: str('quit.title', lang) }),
      h('div', { class: 'q-quit__actions' }, [
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: str('quit.leave', lang), on: { click: leave } }),
        h('button', { type: 'button', class: 'btn btn--primary btn--sm', text: str('quit.stay', lang), on: { click: hideQuit } }),
      ]),
    ]);
    quit.hidden = false;
    quit.querySelector('.btn--primary').focus();
    emitResize();
  }

  function hideQuit() {
    quit.hidden = true;
    if (panel) panel.querySelector('.q-feedback__title')?.focus();
    else { focusFirstOption(host); startClock(); }
    emitResize();
  }

  function leave() {
    finished = true;
    stopClock();
    destroyHandle();
    removePanel();
    onLeave(summary());
  }

  function onKey(e) {
    if (!alive || finished) return;
    const { action, n } = e.detail || {};
    if (action === 'pick') {
      if (panel || !quit.hidden) return;
      const btn = host.querySelector(`button[data-key="${n}"]:not([disabled])`);
      if (btn) btn.click();
    } else if (action === 'continue') {
      if (!quit.hidden) return;
      api_continue();
    } else if (action === 'escape') {
      toggleQuit();
    }
  }

  document.addEventListener('quiz:key', onKey);

  if (wasTimed) {
    clock = createClock({
      seconds: timedSeconds, lang, reduce: motion().reduce, onExpire, onOff: turnOffClock,
    });
    budgetMs = clock.budgetMs;
    clockSlot.appendChild(clock.row);
    clockSlot.hidden = false;
  }

  mountItem();

  return {
    round,
    destroy() {
      alive = false;
      stopClock();
      clearTimeout(timer);
      document.removeEventListener('quiz:key', onKey);
      destroyHandle();
      removePanel();
    },
    summary,
  };
}
