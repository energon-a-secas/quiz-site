/**
 * Getting a set document into the engine, from wherever it came from.
 *
 * One path in: a built-in set named by id and a ?set= URL fetched over CORS
 * are read with the same cap, validated by the same code and scored under the
 * same namespacing rule. A fetched document that reached the scores without
 * passing validate-set.js is the hole the ext: rule exists to close.
 */

import { state } from './state.js';
import { isAllowedSetSrc, namespacedSetId, sha256Hex } from './origin.js';
import { validateSet, firstError, GAMES } from './validate-set.js';
import { str, t, rowWord } from './strings.js';

/** Where a build's own sets are listed. The first path that answers wins. */
export const BUILTIN_INDEX = ['data/sets/index.json', 'data/index.json'];
export const MAX_BYTES = 400 * 1024;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** filter=<field>:<value>[,<value>...]. The field is a label, so is each value. */
const FILTER_RE = /^([A-Za-z0-9_-]+):(.*)$/;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** A load failure the surface can name: code is the quiz:error code, key the string. */
export class SetError extends Error {
  constructor(code, key, vars = {}, detail = '') {
    super(detail || key);
    this.code = code;
    this.key = key;
    this.vars = vars;
    this.detail = detail;
  }
}

/** Normalise one catalog row so the library can rely on its shape. */
function normaliseEntry(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  const items = Array.isArray(raw.items) ? raw.items.length : Number(raw.items ?? raw.count);
  const lic = raw.licence || raw.license || {};
  return {
    id: raw.id,
    game: raw.game,
    name: raw.name || raw.id,
    count: Number.isFinite(items) ? items : null,
    licence: typeof lic === 'string'
      ? { spdx: lic, screen: raw.screen === 'required' ? 'required' : 'none' }
      : { spdx: lic.spdx || null, screen: lic.screen || raw.screen || 'none' },
    file: raw.file || raw.src || raw.path || null,
  };
}

/** The catalog, or an empty list when this build ships none. */
export async function loadBuiltinIndex() {
  for (const path of BUILTIN_INDEX) {
    try {
      const doc = await fetchCapped(path);
      const rows = Array.isArray(doc) ? doc : (Array.isArray(doc?.sets) ? doc.sets : []);
      state.builtin = rows.map(normaliseEntry).filter(Boolean);
      return state.builtin;
    } catch {
      // try the next path
    }
  }
  state.builtin = [];
  console.info(`[quiz] no built-in set catalog at ${BUILTIN_INDEX.join(' or ')}`);
  return state.builtin;
}

export function builtinEntry(id) {
  return state.builtin.find((s) => s.id === id) || null;
}

/** The file a catalog entry points at, or the conventional path for an id. */
export function builtinPath(id) {
  return builtinEntry(id)?.file || `data/sets/${id}.json`;
}

/**
 * Fetch and parse JSON with a byte cap. The body is read in chunks and the
 * request aborted past the cap, so a 40 MB document costs 400 KB, not 40 MB.
 */
export async function fetchCapped(url, cap = MAX_BYTES) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const res = await fetch(url, { cache: 'no-cache', signal: ctl?.signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > cap) {
    ctl?.abort();
    throw new Error(`over the ${Math.round(cap / 1024)} KB cap`);
  }
  let text;
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      got += value.byteLength;
      if (got > cap) {
        ctl?.abort();
        throw new Error(`over the ${Math.round(cap / 1024)} KB cap`);
      }
      chunks.push(value);
    }
    const all = new Uint8Array(got);
    let off = 0;
    chunks.forEach((c) => { all.set(c, off); off += c.byteLength; });
    text = new TextDecoder().decode(all);
  } else {
    text = await res.text();
    if (text.length > cap) throw new Error(`over the ${Math.round(cap / 1024)} KB cap`);
  }
  return JSON.parse(text);
}

/* ── ?filter=, llms.txt "URL parameters" ─────────────────────────────
   Three steps, kept apart so each can be tested on its own: read the
   grammar, narrow the items, say what was narrowed in words. Nothing here
   touches round.pool: the strip and the distractors still draw from the
   whole set, so a round on the k row still shows all five cells. */

/**
 * Read one filter parameter. Returns null when there is none, else
 * { raw, field, values }; a malformed parameter comes back with no field or
 * no values, which the caller reports as filter-empty rather than ignoring.
 * @param {string|null} raw
 */
export function parseFilter(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text) return null;
  const m = FILTER_RE.exec(text);
  if (!m) return { raw: text, field: null, values: [] };
  return { raw: text, field: m[1], values: m[2].split(',').map((v) => v.trim()).filter(Boolean) };
}

/**
 * The items whose <field> is one of the values, matched exactly after trim.
 * Only a label filters: a field holding a number or a bilingual object never
 * matches, so filter=beats:3 and filter=name:x narrow to nothing and are
 * reported rather than quietly returning the whole set.
 */
export function filterItems(items, filter) {
  if (!filter || !filter.field || !filter.values.length) return [];
  const wanted = new Set(filter.values);
  return items.filter((it) => {
    if (!it || typeof it !== 'object' || !has(it, filter.field)) return false;
    const v = it[filter.field];
    return typeof v === 'string' && wanted.has(v.trim());
  });
}

/** "k, s and t", the list join both filter.rows and a group list use. */
function joinLabels(list, lang) {
  if (list.length < 2) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} ${str('filter.and', lang)} ${list[list.length - 1]}`;
}

/**
 * The filter in words, for the round header and the embed bar: the k row, the
 * k and s rows, Greetings, column: i. A group prints its own name from the
 * set's groups (which may fall back to English, and the honesty line says so);
 * a group the set never declared falls through to filter.other rather than
 * printing a raw id as if it were a name.
 */
export function filterWords(filter, set, lang = 'en') {
  if (!filter || !filter.field || !filter.values.length) return '';
  const { field, values } = filter;
  if (field === 'group') {
    const groups = set && set.groups && typeof set.groups === 'object' ? set.groups : null;
    const names = values.map((v) => (groups && has(groups, v) ? t(groups[v], lang) : ''));
    if (names.every(Boolean)) return joinLabels(names, lang);
  }
  if (field === 'row') {
    const words = values.map((v) => rowWord(v, lang));
    return values.length === 1
      ? str('filter.row', lang, { row: words[0] })
      : str('filter.rows', lang, { list: joinLabels(words, lang) });
  }
  return str('filter.other', lang, { field, list: joinLabels(values, lang) });
}

/**
 * Resolve what ?game= and ?set= name into a validated document.
 * @returns {Promise<{ set: object, setId: string, src: string|null }>}
 * @throws {SetError}
 */
export async function resolveSet(cfg) {
  if (cfg.game && !GAMES.includes(cfg.game)) {
    throw new SetError('game-unknown', 'error.game', { game: cfg.game }, `no game called "${cfg.game}"`);
  }
  if (!cfg.set) throw new SetError('no-set', 'error.noSet', {}, 'pass ?set= to this frame');

  let doc;
  let src = null;
  if (SCHEME_RE.test(cfg.set)) {
    if (!isAllowedSetSrc(cfg.set, location.origin)) {
      throw new SetError('set-fetch-failed', 'error.fetch', {}, 'a ?set= URL must be https');
    }
    src = cfg.set;
  } else if (!ID_RE.test(cfg.set)) {
    throw new SetError('set-fetch-failed', 'error.fetch', {}, `"${cfg.set}" is neither a set id nor an https URL`);
  }
  try {
    doc = await fetchCapped(src || builtinPath(cfg.set));
  } catch (e) {
    throw new SetError('set-fetch-failed', 'error.fetch', {}, `could not fetch ${cfg.set}: ${e.message}`);
  }

  const report = validateSet(doc);
  if (!report.ok) {
    const reason = firstError(report);
    throw new SetError('set-invalid', 'error.invalid', { reason }, reason);
  }
  if (cfg.game && doc.game !== cfg.game) {
    throw new SetError('game-mismatch', 'error.mismatch', { setGame: doc.game, game: cfg.game },
      `the set is for ${doc.game}, not ${cfg.game}`);
  }
  const setId = src ? namespacedSetId(doc.id, src, await sha256Hex(src)) : doc.id;
  return { set: doc, setId, src };
}
