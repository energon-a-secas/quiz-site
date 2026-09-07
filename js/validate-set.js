/**
 * Validation of a neo-quiz-set/1 document, from the format in llms.txt.
 *
 * Pure: no DOM, no state, no fetch. Returns { ok, errors: [{ path, message }] }
 * and never throws, so a document from anywhere (a built-in file, a ?set= URL,
 * a host's own book) is judged by one rule before it reaches the round or the
 * scores. tools/validate-set.mjs imports this file and adds the house checks
 * (dashes, unknown fields, the index against its files) that a third-party
 * document is not held to, so there is one notion of valid and it is here.
 */

export const GAMES = ['beats', 'sound', 'pairs', 'order'];
export const COLUMNS = ['a', 'i', 'u', 'e', 'o'];

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SPDX_RE = /^[A-Za-z0-9.+-]+$/;
const LANG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const SKILL_RE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;
/** "a < followed by a letter anywhere is an error" */
const MARKUP_RE = /<[A-Za-z]/;

/** trim, casefold and strip accents: the folding the pairs rule is stated in. */
export function fold(text) {
  // Written as escapes: the literal combining characters survive only until an editor normalises them.
  return String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * A learner-facing value: a bare string is English, an object carries en and
 * es, "es": null means not translated. Pushes errors and returns the strings
 * it found, so the caller can fold them.
 */
function bilingual(value, path, errors, required = true) {
  if (value === null || value === undefined) {
    if (required) errors.push({ path, message: 'is required' });
    return [];
  }
  if (typeof value === 'string') {
    if (!value.trim()) errors.push({ path, message: 'is empty' });
    return [value];
  }
  if (!isObj(value)) { errors.push({ path, message: 'must be a string or an { en, es } object' }); return []; }
  const out = [];
  for (const key of Object.keys(value)) {
    if (key !== 'en' && key !== 'es') { errors.push({ path: `${path}.${key}`, message: 'is not a language key, only en and es exist' }); continue; }
    const v = value[key];
    if (v === null || v === undefined) continue;
    if (typeof v !== 'string') errors.push({ path: `${path}.${key}`, message: 'must be a string or null' });
    else if (!v.trim()) errors.push({ path: `${path}.${key}`, message: 'is empty; use null for not translated' });
    else out.push(v);
  }
  if (!out.length) errors.push({ path, message: 'has neither en nor es' });
  return out;
}

/** Walk every string in the document and refuse a "<" followed by a letter. */
function findMarkup(value, path, errors) {
  if (typeof value === 'string') {
    if (MARKUP_RE.test(value)) errors.push({ path, message: 'contains markup (a "<" followed by a letter), which no field may' });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => findMarkup(v, `${path}[${i}]`, errors));
  } else if (isObj(value)) {
    Object.entries(value).forEach(([k, v]) => findMarkup(v, path ? `${path}.${k}` : k, errors));
  }
}

function checkLicence(lic, errors) {
  if (!isObj(lic)) { errors.push({ path: 'licence', message: 'is required and must be an object' }); return; }
  if (!isStr(lic.spdx) || !SPDX_RE.test(lic.spdx)) errors.push({ path: 'licence.spdx', message: 'must be an SPDX id or "public-domain"' });
  if (lic.screen !== 'required' && lic.screen !== 'none') errors.push({ path: 'licence.screen', message: 'must be "required" or "none"' });
  if (lic.screen === 'required' && !isStr(lic.attribution)) errors.push({ path: 'licence.attribution', message: 'is required when screen is "required"' });
  if (lic.attribution !== undefined && typeof lic.attribution !== 'string') errors.push({ path: 'licence.attribution', message: 'must be a string' });
  if (lic.source !== undefined && !/^https?:\/\/\S+$/i.test(String(lic.source))) errors.push({ path: 'licence.source', message: 'must be an http or https URL' });
}

const itemCheck = {
  beats(it, p, errors) {
    ['word', 'kana', 'romaji'].forEach((k) => { if (!isStr(it[k])) errors.push({ path: `${p}.${k}`, message: 'is required' }); });
    if (!Number.isInteger(it.beats) || it.beats < 1 || it.beats > 9) errors.push({ path: `${p}.beats`, message: 'must be an integer from 1 to 9; a longer word needs another game' });
    if (!Array.isArray(it.split) || !it.split.length || !it.split.every(isStr)) {
      errors.push({ path: `${p}.split`, message: 'must be a non-empty array of kana strings' });
    } else {
      if (it.split.length !== it.beats) errors.push({ path: `${p}.split`, message: `has ${it.split.length} pieces but beats says ${it.beats}` });
      if (isStr(it.kana) && it.split.join('') !== it.kana) errors.push({ path: `${p}.split`, message: 'joined with "" must equal kana' });
    }
    if (it.rule !== null && it.rule !== undefined && !isStr(it.rule)) errors.push({ path: `${p}.rule`, message: 'must be a short code string, or null' });
    if (it.explain !== null && it.explain !== undefined) bilingual(it.explain, `${p}.explain`, errors);
  },
  sound(it, p, errors) {
    ['kana', 'sound', 'row'].forEach((k) => { if (!isStr(it[k])) errors.push({ path: `${p}.${k}`, message: 'is required' }); });
    if (it.column === null) {
      if (it.sound !== 'n') errors.push({ path: `${p}.column`, message: 'may be null for the moraic n only' });
    } else if (!COLUMNS.includes(it.column)) {
      errors.push({ path: `${p}.column`, message: `must be one of ${COLUMNS.join(', ')}, or null for the moraic n` });
    }
    const d = it.distractors;
    if (d !== undefined) {
      if (!Array.isArray(d) || d.length < 3 || !d.every(isStr)) errors.push({ path: `${p}.distractors`, message: 'must be 3 or more sound strings when present' });
      else {
        if (new Set(d).size !== d.length) errors.push({ path: `${p}.distractors`, message: 'repeats a sound' });
        if (d.includes(it.sound)) errors.push({ path: `${p}.distractors`, message: 'contains the right answer' });
      }
    }
  },
  pairs(it, p, errors) {
    const lefts = bilingual(it.left, `${p}.left`, errors);
    const rights = bilingual(it.right, `${p}.right`, errors);
    if (it.note !== undefined && it.note !== null) bilingual(it.note, `${p}.note`, errors);
    for (const l of lefts) {
      for (const r of rights) {
        const fl = fold(l);
        const fr = fold(r);
        if (fl === fr) errors.push({ path: `${p}.right`, message: 'equals left after folding' });
        else if (fl.includes(fr) || fr.includes(fl)) errors.push({ path: `${p}.right`, message: 'one side contains the other after folding, which puts the answer on the board' });
      }
    }
    return rights;
  },
  order(it, p, errors) {
    const t = it.tokens;
    if (!Array.isArray(t) || !t.every(isStr)) { errors.push({ path: `${p}.tokens`, message: 'must be an array of non-empty strings' }); return; }
    // Two pieces is a coin flip and two identical pieces have no wrong order,
    // so neither is a puzzle the slots and the bank were built for.
    if (t.length < 3 || t.length > 9) errors.push({ path: `${p}.tokens`, message: `has ${t.length} pieces; the bank holds 3 to 9 (keys 1 to 9). Split a longer line into two items` });
    if (new Set(t).size !== t.length) errors.push({ path: `${p}.tokens`, message: 'two pieces read the same; merge them or split the line elsewhere' });
    if (!isStr(it.line)) errors.push({ path: `${p}.line`, message: 'is required: the display of the correct line' });
    else if (it.line !== t.join('') && it.line !== t.join(' ')) errors.push({ path: `${p}.line`, message: 'must equal tokens joined with "" or " "' });
    bilingual(it.gloss, `${p}.gloss`, errors);
  },
};

/** Cross-item rules: unique kana and sounds, distractors the set can show, unique rights, a full board. */
function checkSetWide(doc, errors) {
  const items = doc.items.filter(isObj);
  if (doc.game === 'sound') {
    const kana = new Map();
    const sounds = new Map();
    items.forEach((it, i) => {
      if (isStr(it.kana)) { if (kana.has(it.kana)) errors.push({ path: `items[${i}].kana`, message: `${it.kana} is already items[${kana.get(it.kana)}]` }); else kana.set(it.kana, i); }
      if (isStr(it.sound)) { if (sounds.has(it.sound)) errors.push({ path: `items[${i}].sound`, message: `${it.sound} is already the sound of items[${sounds.get(it.sound)}]` }); else sounds.set(it.sound, i); }
    });
    items.forEach((it, i) => {
      (Array.isArray(it.distractors) ? it.distractors : []).forEach((d) => {
        if (isStr(d) && !sounds.has(d)) errors.push({ path: `items[${i}].distractors`, message: `${d} is not the sound of any kana in this set` });
      });
    });
  }
  if (doc.game === 'pairs') {
    if (items.length < 4) errors.push({ path: 'items', message: `has ${items.length}; a board is four pairs, so a set needs at least 4` });
    const rights = new Map();
    items.forEach((it, i) => {
      bilingual(it.right, '', []).forEach((r) => {
        const fr = fold(r);
        if (rights.has(fr)) errors.push({ path: `items[${i}].right`, message: `"${r}" equals the right of items[${rights.get(fr)}] after folding` });
        else rights.set(fr, i);
      });
    });
  }
}

/**
 * @param {unknown} doc  a parsed JSON value
 * @returns {{ ok: boolean, errors: { path: string, message: string }[] }}
 */
export function validateSet(doc) {
  const errors = [];
  if (!isObj(doc)) return { ok: false, errors: [{ path: '', message: 'not a JSON object' }] };
  if (doc.format !== 'neo-quiz-set/1') errors.push({ path: 'format', message: `must be "neo-quiz-set/1", found ${JSON.stringify(doc.format)}` });
  if (!isStr(doc.id) || !ID_RE.test(doc.id)) errors.push({ path: 'id', message: 'must start with a letter or digit, then letters, digits, dot, dash, underscore' });
  if (!DATE_RE.test(String(doc.version || ''))) errors.push({ path: 'version', message: 'must be a YYYY-MM-DD date' });
  if (!GAMES.includes(doc.game)) errors.push({ path: 'game', message: `must be one of ${GAMES.join(', ')}` });
  bilingual(doc.name, 'name', errors);
  if (doc.lang !== undefined && (!isStr(doc.lang) || !LANG_RE.test(doc.lang))) errors.push({ path: 'lang', message: 'must be a BCP 47 tag' });
  if (doc.skill !== undefined && (!isStr(doc.skill) || !SKILL_RE.test(doc.skill))) errors.push({ path: 'skill', message: 'must be a dotted string' });
  checkLicence(doc.licence, errors);
  findMarkup(doc, '', errors);

  if (!Array.isArray(doc.items) || !doc.items.length) {
    errors.push({ path: 'items', message: 'must be a non-empty array' });
    return { ok: false, errors };
  }
  const ids = new Set();
  const check = itemCheck[doc.game];
  doc.items.forEach((it, i) => {
    const p = `items[${i}]`;
    if (!isObj(it)) { errors.push({ path: p, message: 'must be an object' }); return; }
    if (!isStr(it.id) || !ID_RE.test(it.id)) errors.push({ path: `${p}.id`, message: 'must be in the same character set as the set id' });
    else if (ids.has(it.id)) errors.push({ path: `${p}.id`, message: `duplicates ${it.id}; scores are keyed by it` });
    else ids.add(it.id);
    if (check) check(it, p, errors);
  });
  if (check) checkSetWide(doc, errors);
  return { ok: errors.length === 0, errors };
}

/** "items[3].beats: must be an integer from 1 to 9", the one line an error surface shows. */
export function firstError(report) {
  const e = report.errors[0];
  if (!e) return '';
  return e.path ? `${e.path}: ${e.message}` : e.message;
}
