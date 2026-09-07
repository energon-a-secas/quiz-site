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

/**
 * @param {object} o
 * @param {object} o.set        the validated set document
 * @param {string} o.setId      its scoring id (namespaced when fetched)
 * @param {object} o.game       the loaded game module
 * @param {number} o.limit      items per round, already clamped
 * @param {string} o.seed
 * @param {'en'|'es'} o.lang
 * @param {boolean} o.embed
 * @param {string} o.skill
 * @param {HTMLElement} o.root  the surface, emptied here
 * @param {(summary: object) => void} o.onEnd
 * @param {(summary: object) => void} o.onLeave
 */
export function createRound(o) {
  const { set, setId, game, limit, seed, lang, embed, skill, root, onEnd, onLeave } = o;
  const random = rng(seed);
  const items = shuffle(set.items, random).slice(0, limit);
  const total = items.length;
  // items is the round; pool is every item of the set, for distractors and
  // the sound game's row strip, which a round of ten cannot supply on its own.
  const round = { items, index: 0, lang, embed, seed, rng: random, pool: set.items, set };
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

  const gameName = t(game.name, lang);
  const head = h('header', { class: 'q-round-head' }, [
    h('span', { class: 'q-round-head__game', text: gameName }),
    h('span', { class: 'q-round-head__progress' }),
    h('span', { class: 'q-round-head__streak' }),
  ]);
  const trackSlot = h('div', { class: 'q-track-slot' });
  const quit = h('div', { class: 'q-quit', hidden: true, role: 'group', 'aria-labelledby': 'q-quit-title' });
  const host = h('div', { class: 'q-host', id: 'quiz-host' });
  const panelSlot = h('div', { class: 'q-panel-slot' });
  clear(root);
  append(root, [head, trackSlot, quit, host, panelSlot]);

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
        verdict(str('live.wrong', lang, { expected: rec.expected }));
      }
      post('quiz:answer', {
        setId, game: game.id, itemId: rec.itemId, skill, correct: rec.correct, ms, chosen: rec.chosen, expected: rec.expected,
      });
      updateHead(pulse);
    },
    next() {
      if (finished || !alive) return;
      const wrongs = sinceMount.filter((r) => !r.correct);
      if (wrongs.length) showPanel(wrongs);
      else timer = setTimeout(advance, motion().dwell);
    },
    say(text) { live(String(text ?? '')); },
    t: (value, vars) => t(value, lang, vars),
    keycap,
  };

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
    live(str('live.progress', lang, { n: cursor + 1, total }));
    lastAt = performance.now();
    try {
      handle = game.mount(host, round, api) || null;
    } catch (err) {
      console.error(`[quiz] js/games/${game.id}.js threw in mount()`, err);
      clear(host);
      host.appendChild(h('p', { class: 'q-error__detail', role: 'alert', text: `js/games/${game.id}.js: ${err && err.message ? err.message : err}` }));
    }
    focusFirstOption(host);
    emitResize();
  }

  function showPanel(wrongs) {
    removePanel();
    const built = feedbackPanel({
      lang,
      misses: wrongs.map((r) => ({ expected: r.expected, why: r.why })),
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
    };
  }

  function finish() {
    finished = true;
    destroyHandle();
    removePanel();
    onEnd(summary());
  }

  function toggleQuit() {
    if (finished || !alive) return;
    if (!quit.hidden) { hideQuit(); return; }
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
    else focusFirstOption(host);
    emitResize();
  }

  function leave() {
    finished = true;
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

  mountItem();

  return {
    round,
    destroy() {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener('quiz:key', onKey);
      destroyHandle();
      removePanel();
    },
    summary,
  };
}
