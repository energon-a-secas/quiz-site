// sound: a kana is shown and the learner picks its sound, or a sound is shown
// and the learner picks the kana. The direction is chosen per item by seed.
//
// The why is one row of the kana chart, built from the items sharing the
// target's row, in column order a i u e o. The cells light left to right
// and the target stays lit, so a miss is placed on the chart rather than
// just corrected.

import {
  S, el, uid, addStyle, itemRng, clock, shuffle, prompt, optionsGroup, option,
  markCorrect, markWrong, markExpected, settle, announce, why, whyLine, gameRoot,
} from './shared.js';

const COLUMNS = ['a', 'i', 'u', 'e', 'o'];

const STYLE = `
.qz-strip { display: flex; align-items: flex-start; gap: var(--space-2); }
.qz-strip__row { width: 28px; height: 44px; display: grid; place-items: center;
  font-size: var(--text-sm); font-weight: 500; color: var(--text-muted); }
.qz-strip__cells { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.qz-cell { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); }
.qz-cell__kana { width: 44px; height: 44px; display: grid; place-items: center; font-size: var(--text-xl);
  font-weight: 500; color: var(--text-primary); background: var(--surface-2); border-radius: var(--radius-sm);
  animation: qz-sweep 160ms var(--ease-out) both; }
.qz-cell.is-target .qz-cell__kana { animation-name: qz-light; }
.qz-cell__vowel { min-height: 1em; font-size: var(--text-xs); font-weight: 600; color: var(--text-secondary); }
@keyframes qz-sweep { 0% { background: var(--surface-2); } 50% { background: var(--border-strong); } 100% { background: var(--surface-2); } }
@keyframes qz-light { from { background: var(--surface-2); color: var(--text-primary); } to { background: var(--accent); color: var(--bg); } }
@media (prefers-reduced-motion: reduce) {
  .qz-cell__kana { animation: none; animation-delay: 0ms !important; }
  .qz-cell.is-target .qz-cell__kana { animation: qz-light 100ms both; }
}
`;

const columnIndex = (c) => (COLUMNS.includes(c) ? COLUMNS.indexOf(c) : COLUMNS.length);

/**
 * Where the row strip and the distractors draw from. llms.txt hands a module
 * the shuffled round, so a ten-item round of a seventy-kana set would draw a
 * row with holes in it. The engine also passes every item of the set as
 * round.pool (and the document as round.set), a superset of the contract that
 * is read and never written; a host that passes neither gets the round.
 */
export function poolOf(round) {
  const all = Array.isArray(round.pool) ? round.pool
    : round.set && Array.isArray(round.set.items) ? round.set.items : null;
  return all && all.length >= round.items.length ? all : round.items;
}

/** The direction for this item: 'toSound' (kana shown) or 'toKana' (sound shown). */
export function directionFor(rand) {
  return rand() < 0.5 ? 'toSound' : 'toKana';
}

/**
 * Three distractors in the option's face (sounds for toSound, kana for
 * toKana). The item's own distractors first; then the same row or column
 * in the pool; then anything else, so a thin set still fills four options.
 */
export function distractorsFor(item, pool, rand, dir) {
  const face = (x) => (dir === 'toKana' ? x.kana : x.sound);
  const others = pool.filter((x) => x.id !== item.id && x.sound !== item.sound && x.kana !== item.kana);
  const out = [];
  const push = (v) => { if (v && !out.includes(v) && v !== face(item)) out.push(v); };

  if (Array.isArray(item.distractors) && item.distractors.length >= 3) {
    for (const s of shuffle(item.distractors, rand)) {
      if (dir === 'toSound') push(s);
      else push((others.find((x) => x.sound === s) || {}).kana);
    }
  }
  if (out.length < 3) {
    const related = others.filter((x) => x.row === item.row || (item.column && x.column === item.column));
    const rest = others.filter((x) => !related.includes(x));
    for (const x of shuffle(related, rand).concat(shuffle(rest, rand))) {
      if (out.length >= 3) break;
      push(face(x));
    }
  }
  return shuffle(out, rand).slice(0, 3);
}

/** The row of the chart the target sits in, a i u e o, one entry per kana. */
export function rowOf(item, pool) {
  const seen = new Set();
  return pool
    .filter((x) => x.row === item.row && x.kana && !seen.has(x.kana) && seen.add(x.kana))
    .sort((a, b) => columnIndex(a.column) - columnIndex(b.column));
}

export function buildWhy(item, pool, api) {
  const row = rowOf(item, pool);
  if (!row.some((x) => x.kana === item.kana)) row.push(item);
  const cells = row.map((x, i) => {
    const isTarget = x.kana === item.kana;
    const kana = el('span', { class: 'qz-cell__kana', text: x.kana });
    kana.style.animationDelay = `${i * 80}ms`;
    return el('span', { class: `qz-cell${isTarget ? ' is-target' : ''}` }, [
      kana,
      el('span', { class: 'qz-cell__vowel', text: isTarget ? (x.column || '') : '' }),
    ]);
  });
  const strip = el('div', { class: 'qz-strip' }, [
    el('span', { class: 'qz-strip__row', text: item.row }),
    el('div', { class: 'qz-strip__cells' }, cells),
  ]);
  const text = item.column
    ? api.t(S.feedbackSound, { kana: item.kana, row: item.row, column: item.column, sound: item.sound })
    : api.t(S.feedbackSoundAlone, { kana: item.kana, row: item.row, sound: item.sound });
  return { text, node: why([strip, whyLine(text)]) };
}

export default {
  id: 'sound',
  name: S.soundName,
  describe: S.soundDescribe,
  keys: [],

  mount(host, round, api) {
    addStyle('sound', STYLE);
    const item = round.items[round.index];
    if (!item) { api.next(); return { destroy() {} }; }

    const rand = itemRng(round, item);
    const timer = clock();
    const qid = uid('qz-q');
    const pool = poolOf(round);
    const dir = directionFor(rand);
    const target = dir === 'toKana' ? item.kana : item.sound;
    const faces = shuffle([target, ...distractorsFor(item, pool, rand, dir)], rand);
    const root = gameRoot('sound');
    const group = optionsGroup(qid, 'qz-options--2col');
    let done = false;

    const buttons = faces.map((face, i) => {
      const btn = option({ label: face, key: i + 1, cls: 'qz-opt--xl' });
      btn.addEventListener('click', () => pick(face, btn));
      return btn;
    });
    group.append(...buttons);

    function pick(face, btn) {
      if (done) return;
      done = true;
      const correct = face === target;
      const expected = buttons[faces.indexOf(target)];
      if (correct) {
        markCorrect(btn);
      } else {
        markWrong(btn);
        if (expected) markExpected(expected);
      }
      settle(group, [btn, expected]);
      api.answer({
        itemId: item.id,
        correct,
        ms: timer.read(),
        chosen: String(face),
        expected: String(target),
        why: correct ? undefined : buildWhy(item, pool, api),
      });
      announce(api, round, { correct, n: round.index + 1, expected: target });
      api.next();
    }

    root.append(
      prompt({
        main: dir === 'toKana' ? item.sound : item.kana,
        question: api.t(dir === 'toKana' ? S.toKana : S.toSound),
        id: qid,
        mainClass: 'qz-prompt__main--glyph',
      }),
      group,
    );
    host.append(root);

    return {
      destroy() { done = true; },
      focus() { buttons[0]?.focus(); },
    };
  },
};
