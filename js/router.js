/**
 * Boot and the screen switch. Reads the URL, decides where scores live,
 * resolves a set, loads its game, runs the round, shows the results, and goes
 * back to the library. The order matters: the storage decision is made before
 * anything is written and before quiz:ready is posted, so a host is told
 * store: "ephemeral" rather than discovering later that nothing was saved.
 */

import { state, loadAll, savePrefs, persists, recordRound, DEFAULT_LIMIT } from './state.js';
import { readConfig, resolveHostOrigin, mountEmbedBar, setEmbedTitle, startBridge, emitReady, emitError, emitResize, post } from './embed.js';
import { isAllowedOrigin } from './origin.js';
import { loadBuiltinIndex, resolveSet, parseFilter, filterItems, filterWords, SetError } from './sets.js';
import { loadGame, GameLoadError } from './games/index.js';
import { createRound } from './round.js';
import { renderLibrary, renderSkeleton, renderError, renderResults, renderAttribution, relabelChrome, refreshLangNote } from './render.js';
import { initKeys, registerGameKeys } from './keys.js';
import { str, t, beginPage, onFallback } from './strings.js';
import { randomSeed, clear } from './utils.js';

const root = () => document.getElementById('quiz-root');

function browserLang() {
  const l = (navigator.language || '').toLowerCase();
  return l.startsWith('es') ? 'es' : 'en';
}

/**
 * Standalone: the engine persists when the browser lets it. Embedded: only
 * when the referrer is on the allowlist AND the browser lets it. No referrer
 * is not an allowed host.
 */
function decideStore(cfg) {
  if (!cfg.embed) { state.store = state.storageOk ? 'engine' : 'ephemeral'; return; }
  const allowed = isAllowedOrigin(resolveHostOrigin(), location.origin);
  state.store = allowed && state.storageOk ? 'engine' : 'ephemeral';
}

function clampLimit(n, size) {
  const want = Number.isInteger(n) && n > 0 ? n : DEFAULT_LIMIT;
  return Math.max(1, Math.min(want, size));
}

/**
 * The round's items. ?filter= keeps only the items whose one field matches;
 * the whole set stays behind it as round.pool, so the sound game's row strip
 * and the distractors still see every cell. A grammar the parser could not
 * read and a filter that matched nothing are the same thing to a learner
 * (there is no round to play) and the same code to a host: filter-empty.
 * @throws {SetError}
 */
function filteredItems(set, filter) {
  if (!filter) return set.items;
  if (!filter.field || !filter.values.length) {
    throw new SetError('filter-empty', 'error.filter', { filter: filter.raw },
      `"${filter.raw}" is not <field>:<value>[,<value>...]`);
  }
  const items = filterItems(set.items, filter);
  if (!items.length) {
    throw new SetError('filter-empty', 'error.filter', { filter: filter.raw },
      `no item has ${filter.field} equal to ${filter.values.join(' or ')}`);
  }
  return items;
}

function teardown() {
  if (state.round) state.round.destroy();
  state.round = null;
  clear(root());
  // A new screen starts with a clean honesty flag; the games' t() calls that
  // follow set it again if they fall back, and the watcher shows the line.
  beginPage();
  refreshLangNote();
}

function showError(err) {
  teardown();
  state.view = 'error';
  if (err instanceof SetError) {
    emitError(err.code, err.detail || err.message);
    // The invalid case already carries its reason in the message; the others
    // get the fetch detail as a second line, so a 404 and a CORS refusal read differently.
    renderError(root(), { key: err.key, vars: err.vars, detail: err.code === 'set-invalid' ? '' : err.detail });
  } else if (err instanceof GameLoadError) {
    // The contract has five codes and no "engine fault", so a module that
    // failed to import travels as game-unknown with the module path in the
    // message, which is what tells a host it is not a typo in ?game=.
    const missing = err.code === 'game-missing';
    emitError('game-unknown', missing ? `js/games/${err.game}.js did not load: ${err.message}` : err.message);
    const detail = missing ? str('error.module', state.lang, { path: err.path, reason: err.message }) : '';
    renderError(root(), { key: 'error.game', vars: { game: err.game }, detail });
  } else {
    console.error('[quiz]', err);
    const reason = err && err.message ? err.message : String(err);
    emitError('set-invalid', `unexpected while starting the round: ${reason}`);
    renderError(root(), { key: 'error.fetch', detail: reason });
  }
  emitResize();
}

function showLibrary() {
  teardown();
  state.view = 'library';
  state.set = null; state.setId = null; state.game = null; state.gameId = null;
  // The library is never filtered (DESIGN.md 3.3).
  state.filter = null; state.items = null; state.filterLabel = '';
  renderAttribution(null);
  renderLibrary(root(), { onPlay });
  emitResize();
}

function goLibrary() {
  history.pushState(null, '', location.pathname);
  showLibrary();
}

function onPlay({ game, set, limit }) {
  state.prefs.lastGame = game;
  state.prefs.round = limit;
  savePrefs();
  const p = new URLSearchParams({ game, set, limit: String(limit) });
  history.pushState(null, '', `${location.pathname}?${p}`);
  route();
}

/**
 * The results, complete or not. A round left before its end is shown as
 * partial, is never recorded as a score (one right answer then Leave is not a
 * 1/1 best), and is posted with complete: false and the round's total, so a
 * host can decline to mark the exercise finished.
 */
function showResults(summary, { partial = false } = {}) {
  teardown();
  state.view = 'results';
  state.summary = summary;
  if (!partial) {
    recordRound({ game: summary.game, setId: summary.setId, correct: summary.correct, total: summary.answered, bestStreak: summary.bestStreak });
  }
  renderResults(root(), summary, {
    onAgain: () => { state.seed = randomSeed(); startRound(); },
    onChange: goLibrary,
    partial,
  });
  post('quiz:session-end', {
    setId: summary.setId, game: summary.game, answered: summary.answered, correct: summary.correct,
    wrong: summary.wrong, ms: summary.ms, medianMs: summary.medianMs, bestStreak: summary.bestStreak,
    total: summary.total, complete: summary.answered >= summary.total,
  });
  emitResize();
}

function onLeave(summary) {
  if (state.embed) showResults(summary, { partial: summary.answered < summary.total });
  else goLibrary();
}

function startRound() {
  teardown();
  state.view = 'round';
  // After teardown, never before: teardown() clears the fallback flag, and a
  // group name shown in English to a Spanish reader has to be noted on the
  // screen it appears on for the honesty line to show with it.
  state.filterLabel = state.filter ? filterWords(state.filter, state.set, state.lang) : '';
  state.round = createRound({
    set: state.set, setId: state.setId, items: state.items, game: state.game, limit: state.limit,
    seed: state.seed, lang: state.lang, embed: state.embed, skill: state.skill,
    filterLabel: state.filterLabel, root: root(), onEnd: showResults, onLeave,
  });
  emitResize();
}

async function startFromConfig(cfg) {
  teardown();
  state.view = 'loading';
  renderSkeleton(root());
  try {
    const { set, setId, src } = await resolveSet(cfg);
    state.set = set; state.setId = setId; state.setSrc = src;
    state.filter = parseFilter(cfg.filter);
    state.items = filteredItems(set, state.filter);
    state.gameId = cfg.game || set.game;
    state.skill = cfg.skill || set.skill || `quiz.${state.gameId}`;
    // Capped at the filtered length, so quiz:ready reports the round a learner
    // will actually see rather than the length of the set behind it.
    state.limit = clampLimit(cfg.limit ?? state.prefs.round, state.items.length);
    state.seed = cfg.seed || randomSeed();
    state.game = await loadGame(state.gameId);
    registerGameKeys(state.game);
    if (persists()) { state.prefs.lastGame = state.gameId; savePrefs(); }
    if (cfg.embed) {
      setEmbedTitle(t(set.name, state.lang), state.filter ? filterWords(state.filter, set, state.lang) : '');
    }
    renderAttribution(set);
    emitReady();
    startRound();
  } catch (err) {
    showError(err);
  }
}

/** Pick a screen from the URL. Standalone with no set is the library. */
export async function route() {
  const cfg = readConfig();
  state.cfg = cfg;
  if (cfg.set || cfg.embed) await startFromConfig(cfg);
  else showLibrary();
}

function bindGlobal() {
  window.addEventListener('popstate', () => { route(); });
  document.addEventListener('quiz:host-start', (e) => {
    if (!state.set || !state.game) return;
    const d = e.detail || {};
    state.limit = clampLimit(Number.isInteger(d.limit) ? d.limit : (state.cfg?.limit ?? state.prefs.round), (state.items || state.set.items).length);
    state.seed = typeof d.seed === 'string' && d.seed.trim() ? d.seed.trim().slice(0, 64) : randomSeed();
    startRound();
  });
  document.addEventListener('quiz:key', (e) => {
    if (e.detail?.action !== 'restart') return;
    if (!state.set || !state.game || (state.view !== 'round' && state.view !== 'results')) return;
    state.seed = randomSeed();
    startRound();
  });
}

export async function boot() {
  const cfg = readConfig();
  state.cfg = cfg;
  state.embed = cfg.embed;
  if (cfg.theme && /^[\w-]{1,32}$/.test(cfg.theme)) document.documentElement.dataset.theme = cfg.theme;

  loadAll();
  decideStore(cfg);
  state.lang = cfg.lang || state.prefs.lang || browserLang();
  // A host's ?lang= is the host's choice for its frame, not the learner's
  // standalone preference, so only a standalone visit saves it.
  if (cfg.lang && persists() && !cfg.embed) { state.prefs.lang = cfg.lang; savePrefs(); }
  relabelChrome(state.lang);
  onFallback(refreshLangNote);

  if (cfg.embed) {
    mountEmbedBar();
    startBridge();
  }
  initKeys();
  bindGlobal();
  await loadBuiltinIndex();
  await route();
}
