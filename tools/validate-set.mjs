#!/usr/bin/env node
/**
 * The set validator: neo-quiz-set/1 and neo-quiz-set-index/1. llms.txt is the
 * contract; js/validate-set.js is the one implementation of its rules, shared
 * with the engine, and this file adds the house checks a third-party document
 * is not held to: no em or en dash, no unknown field, and the index against
 * the files it names.
 *
 *   node tools/validate-set.mjs                  # every set under data/sets, then the index
 *   node tools/validate-set.mjs path/to/x.json   # named files
 *   node tools/validate-set.mjs data/sets        # a directory: its *.json
 *   make validate-sets
 *
 * It exits 0, or it exits 1 and names the file, the item and the field.
 * Nothing runs it for you: it is not in root `make smoke`. Running it is part
 * of the definition of done for any change under data/sets, which is generated
 * by runcible-site/tools/build-sets.mjs and never edited by hand.
 *
 * Pure below main(): no DOM, no fetch, no storage. Every validate function
 * returns { ok, errors: [{ path, message }], warnings: [...] } and never throws.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSet as validateSetRules, GAMES, fold } from '../js/validate-set.js';

export { GAMES, fold };
export const SET_FORMAT = 'neo-quiz-set/1';
export const INDEX_FORMAT = 'neo-quiz-set-index/1';
export const SCREEN_VALUES = ['required', 'none'];

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** "a < followed by a letter anywhere is an error" */
const MARKUP_RE = /<[A-Za-z]/;
// Written as escapes on purpose: a source file that spells the banned
// character out is itself a hit for the house rule it enforces.
const EM_DASH = '\u2014';
const EN_DASH = '\u2013';

const SET_KEYS = new Set(['format', 'id', 'version', 'game', 'name', 'lang', 'skill', 'licence', 'groups', 'items']);
const ITEM_KEYS = {
  beats: new Set(['id', 'word', 'kana', 'romaji', 'beats', 'split', 'rule', 'explain']),
  sound: new Set(['id', 'kana', 'sound', 'row', 'column', 'distractors']),
  pairs: new Set(['id', 'left', 'right', 'note', 'group', 'row', 'column']),
  order: new Set(['id', 'tokens', 'line', 'gloss']),
};

/** The columns a yoon row holds, three where a plain row holds five. */
const YOON_COLUMNS = ['ya', 'yu', 'yo'];
/** The fields ?filter= matches. A round is only as filterable as these are. */
const FILTER_FIELDS = ['row', 'column', 'group'];
/**
 * Hepburn in macron style: the letters, the five macron vowels and the
 * apostrophe of n' before a vowel. A circumflex, oo and ou are the three
 * spellings llms.txt names and refuses.
 */
const ROMAJI_RE = /^[a-zāīūēō']+$/;
const ROMAJI_BAD = /[âêîôû]|oo|ou/;

function newReport() {
  const errors = [];
  const warnings = [];
  return {
    err(path, message) { errors.push({ path, message }); },
    warn(path, message) { warnings.push({ path, message }); },
    done() { return { ok: errors.length === 0, errors, warnings }; },
  };
}

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function isStr(v) { return typeof v === 'string' && v.trim().length > 0; }

/** Every string reachable from `value`, with its dotted path. */
function* walkStrings(value, at) {
  if (typeof value === 'string') { yield [at, value]; return; }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) yield* walkStrings(value[i], `${at}[${i}]`);
    return;
  }
  if (isObj(value)) {
    for (const [k, v] of Object.entries(value)) yield* walkStrings(v, `${at}.${k}`);
  }
}

/** The house rules every string in a shipped document meets. */
function checkHouseStrings(r, doc) {
  for (const [at, s] of walkStrings(doc, '$')) {
    if (s.includes(EM_DASH)) r.err(at, 'contains an em dash');
    else if (s.includes(EN_DASH)) r.err(at, 'contains an en dash');
  }
}

/**
 * A bilingual value for the index: a bare string is English, an object
 * carries en and es, "es": null means not translated.
 */
function checkBilingual(r, path, value) {
  if (value === null || value === undefined) { r.err(path, 'is required'); return; }
  if (typeof value === 'string') { if (!value.trim()) r.err(path, 'is empty'); return; }
  if (!isObj(value)) { r.err(path, 'must be a string or an { en, es } object'); return; }
  let found = 0;
  for (const key of Object.keys(value)) {
    if (key !== 'en' && key !== 'es') { r.err(`${path}.${key}`, 'is not a language key, only en and es exist'); continue; }
    const v = value[key];
    if (v === null || v === undefined) continue;
    if (typeof v !== 'string') r.err(`${path}.${key}`, 'must be a string or null');
    else if (!v.trim()) r.err(`${path}.${key}`, 'is empty; use null for not translated');
    else found += 1;
  }
  if (!found) r.err(path, 'has neither en nor es');
}

/**
 * A row holds one kind of column and no cell twice. js/validate-set.js runs
 * this over a sound set; a kana pairs set carries the same row and column and
 * is read by the same filter, so it is held to the same shape here.
 */
function checkRowShape(r, items) {
  const rows = new Map();
  items.forEach((it, i) => {
    if (!isStr(it.row)) return;
    const cell = it.column === null || it.column === undefined ? 'none' : String(it.column);
    const kind = cell === 'none' ? 'none' : (YOON_COLUMNS.includes(cell) ? 'yoon' : 'plain');
    const row = rows.get(it.row) || { kind: null, cells: new Map() };
    if (row.kind && row.kind !== kind) r.err(`items[${i}].column`, `the ${it.row} row already holds ${row.kind} columns; a row holds one kind`);
    else if (!row.kind) row.kind = kind;
    if (row.cells.has(cell)) r.err(`items[${i}].column`, `the ${it.row} row already has its ${cell} cell, items[${row.cells.get(cell)}]`);
    else row.cells.set(cell, i);
    rows.set(it.row, row);
  });
}

/**
 * The house rules on a generated set, all of them about a promise the site
 * makes on screen rather than about JSON shape:
 *
 * - a filter field is carried by every item or by none. filter=row:k on a set
 *   where half the items have no row is not an empty filter and not an error
 *   anywhere; it is a round quietly missing the items that never had the field
 * - a group is a key of groups, and every declared group is on an item, so the
 *   round header always has words for the filter it names
 * - a beats romaji is a string, never null, in macron style: it is the line the
 *   learner reads after the answer, and "koohii" would teach the wrong count
 * - an order gloss is { en, es } with es a string or null, never a bare string:
 *   a bare string is English wearing no label, and the honesty line under the
 *   surface is what tells a Spanish reader the gloss fell back
 */
function checkHouseItems(r, doc) {
  const items = Array.isArray(doc.items) ? doc.items.filter(isObj) : [];
  if (!items.length) return;

  for (const field of FILTER_FIELDS) {
    const carried = items.filter((it) => it[field] !== undefined).length;
    if (carried && carried !== items.length) {
      const i = items.findIndex((it) => it[field] === undefined);
      r.err(`items[${i}].${field}`, `is missing while ${carried} of the ${items.length} items carry it; filter=${field}: would drop them from the round without saying so`);
    }
  }

  if (isObj(doc.groups)) {
    const used = new Set(items.map((it) => it.group).filter(isStr));
    for (const id of Object.keys(doc.groups)) {
      if (!used.has(id)) r.err(`groups.${id}`, 'is declared but no item carries it, so filter=group: on it is an empty round');
    }
  } else if (items.some((it) => isStr(it.group))) {
    r.err('groups', 'is missing while items carry a group; the round header would have no words for filter=group:');
  }

  // js/validate-set.js runs the same shape over a sound set, so this is the
  // pairs half only and the report never says it twice.
  if (doc.game === 'pairs') checkRowShape(r, items);

  if (doc.game === 'sound') {
    items.forEach((it, i) => {
      if (!has(it, 'column')) r.err(`items[${i}].column`, 'is required: null for the moraic n, a vowel or a yoon column otherwise');
    });
  }

  if (doc.game === 'beats') {
    items.forEach((it, i) => {
      if (!isStr(it.romaji)) { r.err(`items[${i}].romaji`, 'is required and never null: it is what the feedback prints under the beat tiles'); return; }
      if (ROMAJI_BAD.test(it.romaji) || !ROMAJI_RE.test(it.romaji)) {
        r.err(`items[${i}].romaji`, `"${it.romaji}" is not Hepburn in macron style: a long vowel is one of ā ī ū ē ō, never oo, ou or a circumflex`);
      }
    });
  }

  if (doc.game === 'order') {
    items.forEach((it, i) => {
      const g = it.gloss;
      if (!isObj(g)) { r.err(`items[${i}].gloss`, 'must be an { en, es } object; a bare string is English with nothing saying so'); return; }
      if (!isStr(g.en)) r.err(`items[${i}].gloss.en`, 'is required: the line the results screen reads back');
      // A value that is neither is already an error in js/validate-set.js; the
      // key being absent is not, and it reads on screen as a missing gloss.
      if (!has(g, 'es')) r.err(`items[${i}].gloss.es`, 'is required: a string, or null for a gloss nobody has translated');
    });
  }
}

// ---------------------------------------------------------------- documents

/** One neo-quiz-set/1 document: the contract's rules, then the house checks. */
export function validateSet(doc, { name = 'set' } = {}) {
  const r = newReport();
  if (!isObj(doc)) { r.err(name, 'is not a JSON object'); return r.done(); }
  for (const e of validateSetRules(doc).errors) r.err(e.path || name, e.message);
  for (const key of Object.keys(doc)) {
    if (!SET_KEYS.has(key) && !key.startsWith('_')) r.warn(key, 'is not a field of neo-quiz-set/1 and the engine ignores it');
  }
  checkHouseStrings(r, doc);
  checkHouseItems(r, doc);
  const itemKeys = GAMES.includes(doc.game) ? ITEM_KEYS[doc.game] : null;
  if (itemKeys && Array.isArray(doc.items)) {
    doc.items.forEach((it, i) => {
      if (!isObj(it)) return;
      for (const key of Object.keys(it)) {
        if (!itemKeys.has(key) && !key.startsWith('_')) r.warn(`items[${i}].${key}`, `is not a field of a ${doc.game} item and the engine ignores it`);
      }
    });
  }
  return r.done();
}

/** The built-in catalog, neo-quiz-set-index/1. */
export function validateSetIndex(doc, { name = 'index' } = {}) {
  const r = newReport();
  if (!isObj(doc)) { r.err(name, 'is not a JSON object'); return r.done(); }
  if (doc.format !== INDEX_FORMAT) r.err('format', `must be "${INDEX_FORMAT}", found ${JSON.stringify(doc.format)}`);
  if (!DATE_RE.test(String(doc.version || ''))) r.err('version', 'must be a YYYY-MM-DD date');
  if (!Array.isArray(doc.sets)) { r.err('sets', 'must be an array'); return r.done(); }
  const ids = new Set();
  doc.sets.forEach((s, i) => {
    const at = `sets[${i}]`;
    if (!isObj(s)) { r.err(at, 'must be an object'); return; }
    if (!isStr(s.id) || !ID_RE.test(s.id)) r.err(`${at}.id`, 'must be a set id');
    else if (ids.has(s.id)) r.err(`${at}.id`, `duplicates ${s.id}`);
    else ids.add(s.id);
    if (!isStr(s.file) || /^[a-z]+:/i.test(s.file) || s.file.startsWith('/') || s.file.split('/').includes('..')) {
      r.err(`${at}.file`, 'must be a path relative to the site root, no scheme, no leading slash, no ".."');
    }
    if (!GAMES.includes(s.game)) r.err(`${at}.game`, `must be one of ${GAMES.join(', ')}`);
    checkBilingual(r, `${at}.name`, s.name);
    if (!Number.isInteger(s.items) || s.items < 1) r.err(`${at}.items`, 'must be a positive integer');
    if (!isStr(s.licence)) r.err(`${at}.licence`, 'must be the set\'s spdx string');
    if (!SCREEN_VALUES.includes(s.screen)) r.err(`${at}.screen`, `must be one of ${SCREEN_VALUES.join(', ')}`);
  });
  for (const [at, s] of walkStrings(doc, '$')) {
    if (MARKUP_RE.test(s)) r.err(at, 'contains markup');
  }
  checkHouseStrings(r, doc);
  return r.done();
}

export function formatReport(report) {
  return [
    ...report.errors.map((e) => `  error  ${e.path}: ${e.message}`),
    ...report.warnings.map((e) => `  warn   ${e.path}: ${e.message}`),
  ].join('\n');
}

// ---------------------------------------------------------------- command line

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SETS_DIR = 'data/sets';

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

/** Validate one file, choosing the schema from its own format field. */
export async function validateFile(path) {
  const name = relative(ROOT, path) || path;
  let doc;
  try {
    doc = await readJson(path);
  } catch (e) {
    return { name, doc: null, report: { ok: false, errors: [{ path: name, message: `unreadable: ${e.message}` }], warnings: [] } };
  }
  const format = doc && doc.format;
  if (format === SET_FORMAT) return { name, doc, report: validateSet(doc, { name }) };
  if (format === INDEX_FORMAT) return { name, doc, report: validateSetIndex(doc, { name }) };
  return {
    name,
    doc,
    report: {
      ok: false,
      errors: [{ path: `${name}.format`, message: `must be "${SET_FORMAT}" or "${INDEX_FORMAT}", got ${JSON.stringify(format)}` }],
      warnings: [],
    },
  };
}

/** The index names what ships: every row must point at a set that agrees with it. */
async function crossCheck(index, name) {
  const r = newReport();
  for (const [i, s] of (index.sets || []).entries()) {
    const at = `sets[${i}]`;
    if (!isStr(s.file)) continue;
    const abs = join(ROOT, s.file);
    let doc;
    try { await stat(abs); doc = await readJson(abs); } catch { r.err(`${at}.file`, `${s.file} is not on disk or does not parse`); continue; }
    if (doc.id !== s.id) r.err(`${at}.id`, `is ${s.id} but ${s.file} says ${doc.id}`);
    if (doc.game !== s.game) r.err(`${at}.game`, `is ${s.game} but ${s.file} says ${doc.game}`);
    const n = Array.isArray(doc.items) ? doc.items.length : 0;
    if (n !== s.items) r.err(`${at}.items`, `says ${s.items} but ${s.file} carries ${n}`);
    if (!doc.licence || doc.licence.spdx !== s.licence) r.err(`${at}.licence`, `is ${s.licence} but ${s.file} says ${doc.licence && doc.licence.spdx}`);
    if (!doc.licence || doc.licence.screen !== s.screen) r.err(`${at}.screen`, `is ${s.screen} but ${s.file} says ${doc.licence && doc.licence.screen}`);
  }
  return { name: `${name} (against its files)`, report: r.done() };
}

/** The *.json under a directory, sorted; a file is itself. */
async function expand(path) {
  const info = await stat(path).catch(() => null);
  if (!info || !info.isDirectory()) return [path];
  const names = await readdir(path);
  return names.filter((n) => n.endsWith('.json')).sort().map((n) => join(path, n));
}

async function main() {
  const args = process.argv.slice(2);
  const roots = args.length ? args.map((a) => resolve(process.cwd(), a)) : [join(ROOT, SETS_DIR)];
  const files = (await Promise.all(roots.map(expand))).flat();
  if (files.length === 0) {
    console.log(`No set documents found under ${SETS_DIR}`);
    return 0;
  }

  let bad = 0;
  let warnings = 0;
  let sets = 0;
  let items = 0;
  const say = ({ name, report }) => {
    warnings += report.warnings.length;
    if (report.ok && report.warnings.length === 0) { console.log(`  ok    ${name}`); return; }
    console.log(`  ${report.ok ? 'warn ' : 'FAIL '} ${name}`);
    console.log(formatReport(report));
    if (!report.ok) bad += 1;
  };
  for (const file of files) {
    const result = await validateFile(file);
    say(result);
    if (result.doc && result.doc.format === SET_FORMAT) { sets += 1; items += result.doc.items.length; }
    if (result.doc && result.doc.format === INDEX_FORMAT && result.report.ok) say(await crossCheck(result.doc, result.name));
  }
  console.log(`\n${files.length} document(s), ${sets} sets, ${items} items, ${bad} invalid, ${warnings} warning(s)`);
  return bad === 0 ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith('validate-set.mjs')) {
  process.exit(await main());
}
