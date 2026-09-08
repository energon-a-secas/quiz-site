// pairs: a board of up to four pairs, left column in set order, right column
// shuffled by seed. Tap a left item, then a right one. Nothing but left and
// right is on the board: no romaji, no gloss, no note, and none of the labels
// a kana item carries for ?filter= (row, column, group), so the answer is
// never in the prompt (the set format refuses a pair where either side
// contains the other; the note is shown only after a miss).
//
// right is a bilingual value: the board prints the reader's language, English
// when "es" is null, and the honesty line under the surface says so once. A
// bare string is English and is not a fallback, which is why a romaji right
// ("inu") never trips that line. The format holds rights apart per language,
// and that is what lets a lock be decided by comparing the printed strings.
//
// Each left item is decided by its first attempt. A mismatch marks the left
// item for one attempt and the learner keeps going; later taps that resolve
// it record nothing. The keycaps sit on whichever column is answerable now
// and are numbered by position, so a locked item keeps its neighbours' digits.
//
// Three states, three shapes: a picked item is a tint (selection), focus is a
// ring (you are here), a locked item is a quiet accent border, and a pair
// that was missed first keeps a danger border once it locks, so the board
// still shows where the miss was when the panel opens.

import {
  S, el, uid, addStyle, itemRng, clock, shuffle, prompt, optionsGroup, option, capOf, setKey,
  announce, why, gameRoot,
} from './shared.js';

const STYLE = `
.qz-board { grid-template-columns: 1fr 1fr; gap: var(--space-3) var(--space-4); }
.qz-col { display: grid; gap: var(--space-3); align-content: start; min-width: 0; }
.qz-opt.is-picked, .qz-opt.is-picked:hover { background: color-mix(in oklab, var(--accent) 18%, transparent); border-color: var(--accent); box-shadow: none; }
.qz-opt.is-miss { border-color: var(--danger); box-shadow: inset 0 0 0 1px var(--danger); animation: qz-nudge 120ms var(--ease-out); }
.qz-opt.is-locked, .qz-opt.is-locked:disabled { border-color: var(--accent); opacity: .8; }
.qz-opt.is-locked.is-missed, .qz-opt.is-locked.is-missed:disabled { border-color: var(--danger); }
.qz-pair { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2) var(--space-3); font-size: var(--text-lg); font-weight: 500; }
.qz-pair__join { color: var(--text-muted); font-size: var(--text-sm); }
.qz-pair__reading { display: flex; flex-direction: column; gap: var(--space-1); }
.qz-pair__note { color: var(--text-secondary); font-size: var(--text-lg); }
@media (max-width: 480px) { .qz-board { gap: var(--space-2); } .qz-col { gap: var(--space-2); } }
@media (prefers-reduced-motion: reduce) { .qz-opt.is-miss { animation: qz-fade 100ms; } }
`;

/** The right column, shuffled so it does not read as the left when it can help it. */
export function shuffledRights(rights, rand) {
  let out = rights;
  for (let tries = 0; tries < 8; tries += 1) {
    out = shuffle(out, rand);
    if (rights.length < 2 || out.some((r, i) => r !== rights[i])) break;
  }
  return out;
}

/**
 * Both faces resolved to this round's language. Resolving is what records a
 * fallback, so the board's own t() calls are what raise the honesty line: a
 * face nobody prints never raises it.
 */
export function facesOf(item, api) {
  return { left: api.t(item.left), right: api.t(item.right) };
}

/** The pair as the board printed it, so the panel repeats it word for word. */
export function buildWhy(item, api, face = null) {
  const { left, right } = face || facesOf(item, api);
  const text = api.t(S.feedbackPairs, { left, right });
  return {
    text,
    node: why([
      el('div', { class: 'qz-pair' }, [
        el('span', { text: left }),
        el('span', { class: 'qz-pair__join', 'aria-hidden': 'true', text: '↔' }),
        el('span', { text: right }),
      ]),
      item.note ? el('div', { class: 'qz-pair__reading' }, [
        el('span', { class: 'qz-why__label', text: api.t(S.pairsReading) }),
        el('p', { class: 'qz-pair__note', text: api.t(item.note) }),
      ]) : null,
    ]),
  };
}

export default {
  id: 'pairs',
  name: S.pairsName,
  describe: S.pairsDescribe,
  keys: [],

  mount(host, round, api) {
    addStyle('pairs', STYLE);
    const items = round.items.slice(round.index, round.index + 4);
    if (!items.length) { api.next(); return { destroy() {} }; }

    const rand = itemRng(round, items[0]);
    const timer = clock();
    const qid = uid('qz-q');
    const faces = items.map((item) => facesOf(item, api));
    const rights = shuffledRights(faces.map((f) => f.right), rand);
    const root = gameRoot('pairs');
    const board = optionsGroup(qid, 'qz-board');
    const leftCol = el('div', { class: 'qz-col' });
    const rightCol = el('div', { class: 'qz-col' });
    const attempted = new Set();
    let picked = null;
    let locked = 0;
    let done = false;

    const lefts = items.map((item, i) => {
      const btn = option({ label: faces[i].left, key: i + 1 });
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => pickLeft(item, faces[i], btn));
      return btn;
    });
    const rightBtns = rights.map((text, i) => {
      const btn = option({ label: text, key: i + 1 });
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => pickRight(text, btn));
      return btn;
    });
    leftCol.append(...lefts);
    rightCol.append(...rightBtns);
    board.append(leftCol, rightCol);

    /** Put the digits on one column and hide the other's keycaps. */
    function arm(column) {
      const on = column === 'left' ? lefts : rightBtns;
      const off = column === 'left' ? rightBtns : lefts;
      on.forEach((b, i) => {
        const live = !b.disabled;
        setKey(b, live ? i + 1 : null);
        capOf(b)?.classList.toggle('is-idle', !live);
      });
      off.forEach((b) => {
        setKey(b, null);
        capOf(b)?.classList.add('is-idle');
      });
    }

    function pickLeft(item, face, btn) {
      if (done || btn.disabled) return;
      if (picked && picked.btn === btn) {
        btn.classList.remove('is-picked', 'is-miss');
        btn.setAttribute('aria-pressed', 'false');
        picked = null;
        arm('left');
        return;
      }
      if (picked) {
        picked.btn.classList.remove('is-picked', 'is-miss');
        picked.btn.setAttribute('aria-pressed', 'false');
      }
      picked = { item, face, btn };
      btn.classList.add('is-picked');
      btn.setAttribute('aria-pressed', 'true');
      arm('right');
      rightBtns.find((b) => !b.disabled)?.focus();
    }

    function pickRight(text, btn) {
      if (done || btn.disabled || !picked) return;
      const { item, face, btn: leftBtn } = picked;
      const correct = text === face.right;
      const first = !attempted.has(item.id);
      attempted.add(item.id);
      if (first) {
        api.answer({
          itemId: item.id,
          correct,
          ms: timer.read(),
          chosen: String(text),
          expected: String(face.right),
          why: correct ? undefined : buildWhy(item, api, face),
        });
        announce(api, round, { correct, n: round.index + attempted.size, expected: face.right });
      }
      if (!correct) {
        leftBtn.classList.remove('is-miss');
        void leftBtn.offsetWidth;
        leftBtn.classList.add('is-miss');
        return;
      }
      if (!first) api.say(api.t(S.feedbackPairs, { left: face.left, right: face.right }));
      const missed = leftBtn.classList.contains('is-miss');
      for (const b of [leftBtn, btn]) {
        b.classList.remove('is-picked', 'is-miss');
        b.classList.add('is-locked');
        if (missed && b === leftBtn) b.classList.add('is-missed');
        b.setAttribute('aria-pressed', 'true');
        b.disabled = true;
      }
      picked = null;
      locked += 1;
      timer.reset();
      arm('left');
      if (locked === items.length) {
        done = true;
        api.next();
        return;
      }
      lefts.find((b) => !b.disabled)?.focus();
    }

    /**
     * The clock ran out with the board unfinished. It misses the first pair
     * that has no answer yet: a pair already attempted was decided by that
     * first attempt (the contract's rule, one answer per pair), so scoring it
     * again here would count one item twice. The board settles with that
     * pair marked, and the panel lists it with every other miss.
     */
    function expire() {
      if (done) return;
      done = true;
      if (picked) {
        picked.btn.classList.remove('is-picked');
        picked.btn.setAttribute('aria-pressed', 'false');
      }
      const at = items.findIndex((it) => !attempted.has(it.id));
      for (const b of [...lefts, ...rightBtns]) b.disabled = true;
      if (at >= 0) {
        const item = items[at];
        const face = faces[at];
        attempted.add(item.id);
        lefts[at].classList.add('is-miss');
        api.answer({
          itemId: item.id,
          correct: false,
          ms: timer.read(),
          chosen: '',
          expected: String(face.right),
          why: buildWhy(item, api, face),
        });
      }
      api.next();
    }

    arm('left');
    root.append(
      prompt({ question: api.t(S.pairsPrompt), id: qid }),
      board,
    );
    host.append(root);

    return {
      destroy() { done = true; },
      expire,
      focus() { lefts.find((b) => !b.disabled)?.focus(); },
    };
  },
};
