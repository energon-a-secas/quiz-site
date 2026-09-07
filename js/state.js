/**
 * Shared state and the two stores, quiz:prefs:v1 and quiz:scores:v1.
 *
 * Both go through the Persist kit (safeGetJSON / safeSetJSON never throw:
 * private mode and a full quota return the fallback and false). The stored
 * documents carry v: 1 at the top, exactly as llms.txt shows them, and a
 * document with another v is ignored rather than migrated.
 *
 * Nothing is written while state.store is "ephemeral": an embedded frame
 * whose host is not on the allowlist, or a browser that refused the probe.
 * That is the one invariant, and persists() is the only gate.
 */

import { safeGetJSON, safeSetJSON, storageAvailable } from './neorgon-persist.js';

export const PREFS_KEY = 'quiz:prefs:v1';
export const SCORES_KEY = 'quiz:scores:v1';
export const ROUND_SIZES = [5, 10, 20];
export const DEFAULT_LIMIT = 10;

export const state = {
  /** library | loading | round | results | error */
  view: 'library',
  lang: 'en',
  embed: false,
  /** engine | ephemeral. Reported on quiz:ready. */
  store: 'engine',
  storageOk: true,
  hostOrigin: null,
  prefs: { lang: null, round: DEFAULT_LIMIT, lastGame: null },
  scores: { rounds: {} },
  /** the built-in catalog, normalised by js/sets.js */
  builtin: [],
  /** what the URL said, from js/embed.js readConfig() */
  cfg: null,
  /** the resolved set document, its scoring id and where it came from */
  set: null,
  setId: null,
  setSrc: null,
  /** the loaded game module and its id */
  game: null,
  gameId: null,
  limit: DEFAULT_LIMIT,
  seed: null,
  skill: null,
  /** the live runner from js/round.js, and the last summary */
  round: null,
  summary: null,
};

/** true when a write should reach disk. */
export function persists() {
  return state.store === 'engine';
}

export function loadAll() {
  state.storageOk = storageAvailable();
  const prefs = safeGetJSON(PREFS_KEY, null);
  if (prefs && typeof prefs === 'object' && prefs.v === 1) {
    if (prefs.lang === 'en' || prefs.lang === 'es') state.prefs.lang = prefs.lang;
    if (ROUND_SIZES.includes(prefs.round)) state.prefs.round = prefs.round;
    if (typeof prefs.lastGame === 'string') state.prefs.lastGame = prefs.lastGame;
  }
  const scores = safeGetJSON(SCORES_KEY, null);
  if (scores && typeof scores === 'object' && scores.v === 1 && scores.rounds && typeof scores.rounds === 'object') {
    state.scores = { rounds: { ...scores.rounds } };
  }
}

export function savePrefs() {
  if (!persists()) return false;
  return safeSetJSON(PREFS_KEY, {
    v: 1,
    lang: state.prefs.lang,
    round: state.prefs.round,
    lastGame: state.prefs.lastGame,
  });
}

export function scoreKey(game, setId) {
  return `${game}/${setId}`;
}

/** The stored row for one game and set, or null. */
export function lastScore(game, setId) {
  const row = state.scores.rounds[scoreKey(game, setId)];
  return row && typeof row === 'object' ? row : null;
}

/** Record a finished round. Returns false when nothing was written. */
export function recordRound({ game, setId, correct, total, bestStreak }) {
  if (!persists() || !total) return false;
  const key = scoreKey(game, setId);
  const prev = lastScore(game, setId) || { played: 0, best: null, bestStreak: 0 };
  const beats = !prev.best || correct / total > prev.best.correct / prev.best.total
    || (correct / total === prev.best.correct / prev.best.total && total > prev.best.total);
  state.scores.rounds[key] = {
    played: (prev.played || 0) + 1,
    last: { correct, total, at: Date.now() },
    best: beats ? { correct, total } : prev.best,
    bestStreak: Math.max(prev.bestStreak || 0, bestStreak || 0),
  };
  return safeSetJSON(SCORES_KEY, { v: 1, rounds: state.scores.rounds });
}
