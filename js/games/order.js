// order: put a song line's tokens back in order. A row of empty slots, then
// a bank of shuffled chips with keycaps 1 to N. Tapping a chip moves it to
// the next slot and leaves a dimmed ghost in its bank slot, so key 3 means
// the third chip all round. Backspace, or the undo button, returns the last
// piece. The answer commits when the last slot fills.
//
// On a correct line the chips slide into one line of text (FLIP, transform
// only). On a miss the correct line is shown with the first misplaced token
// outlined and the learner's token hanging under it, struck through, then the
// gloss. The marked line is the whole what and why, so the panel's "The
// answer was" line is skipped for this game (showWhat: false).

import {
  S, el, uid, addStyle, itemRng, clock, shuffle, reducedMotion, isTyping, shortcutsOff,
  prompt, option, check, announce, why, gameRoot,
} from './shared.js';

const STYLE = `
.qz-slots { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2); }
.qz-slot { min-width: 56px; min-height: var(--control-height); padding: 0 var(--space-3); display: grid; place-items: center;
  border: 1px dashed var(--border-strong); border-radius: var(--radius); font-size: var(--text-lg); font-weight: 500;
  color: var(--text-primary); transition: border-color var(--dur-fast), background-color var(--dur-fast), opacity var(--dur); }
.qz-slot.is-filled { border-style: solid; border-color: var(--border); background: var(--surface-2); }
.qz-slot.is-miss { border-color: var(--danger); box-shadow: inset 0 0 0 1px var(--danger); }
.qz-slots.is-settled .qz-slot:not(.is-miss) { opacity: .6; }
.qz-bank { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-3); }
.qz-chip { grid-template-columns: var(--keycap, 28px) auto; }
.qz-chip.is-used, .qz-chip.is-used:disabled { opacity: .35; }
.qz-tools { display: flex; justify-content: center; }
.qz-line { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 0 .35em;
  font-size: 1.5rem; font-weight: 500; line-height: 1.3; color: var(--text-primary); }
.qz-line--tight { column-gap: 0; }
.qz-line__tok { display: inline-block; }
.qz-line__tok.is-miss { outline: 2px solid var(--danger); outline-offset: 3px; border-radius: var(--radius-sm); }
.qz-line__chosen { display: block; margin: var(--space-1) 0 0; text-align: center; font-size: var(--text-base); font-weight: 400; color: var(--text-muted); text-decoration: line-through; }
.qz-line .qz-check { position: static; translate: none; align-self: center; margin-left: .25em; color: var(--accent); }
.qz-gloss { display: flex; flex-direction: column; gap: var(--space-1); color: var(--text-secondary); }
@media (prefers-reduced-motion: reduce) { .qz-line { animation: qz-fade 100ms both; } .qz-line__tok { transition: none !important; } }
`;

/** The line's separator: the format says line is the tokens joined with "" or " ". */
export function separatorOf(item) {
  return item.tokens.join(' ') === item.line ? ' ' : '';
}

/** The bank order, shuffled so it is not already the answer when it can help it. */
export function bankOrder(tokens, rand) {
  let idx = tokens.map((_, i) => i);
  for (let tries = 0; tries < 8; tries += 1) {
    idx = shuffle(idx, rand);
    if (idx.some((i, k) => tokens[i] !== tokens[k])) break;
  }
  return idx;
}

/** The correct line with the first misplaced token marked. */
export function buildWhy(item, learner, missAt, api) {
  const sep = separatorOf(item);
  const line = el('div', { class: `qz-line${sep ? '' : ' qz-line--tight'}` }, item.tokens.map((tok, k) => {
    const span = el('span', { class: `qz-line__tok${k === missAt ? ' is-miss' : ''}`, text: tok });
    if (k !== missAt) return span;
    return el('span', { class: 'qz-line__tok' }, [
      span,
      el('span', { class: 'qz-line__chosen', text: learner[k] }),
    ]);
  }));
  const text = api.t(S.feedbackOrder, { token: item.tokens[missAt], chosen: learner[missAt] });
  return {
    text,
    showWhat: false,
    node: why([
      line,
      item.gloss ? el('div', { class: 'qz-gloss' }, [
        el('span', { class: 'qz-why__label', text: api.t(S.orderGloss) }),
        el('p', { text: api.t(item.gloss) }),
      ]) : null,
    ]),
  };
}

export default {
  id: 'order',
  name: S.orderName,
  describe: S.orderDescribe,
  keys: ['Backspace'],

  mount(host, round, api) {
    addStyle('order', STYLE);
    const item = round.items[round.index];
    if (!item) { api.next(); return { destroy() {} }; }

    const rand = itemRng(round, item);
    const timer = clock();
    const qid = uid('qz-q');
    const tokens = item.tokens.slice(0, 9);
    const sep = separatorOf(item);
    const order = bankOrder(tokens, rand);
    const root = gameRoot('order');
    const placed = [];
    let done = false;

    const slots = tokens.map(() => el('li', { class: 'qz-slot' }));
    const slotList = el('ol', { class: 'qz-slots', 'aria-label': api.t(S.orderLine) }, slots);
    const chips = order.map((tokIdx, i) => {
      const btn = option({ label: tokens[tokIdx], key: i + 1, cls: 'qz-chip' });
      btn.addEventListener('click', () => place(i));
      return btn;
    });
    const bank = el('div', { class: 'qz-bank', role: 'group', 'aria-label': api.t(S.orderBank) }, chips);
    const undoBtn = el('button', {
      type: 'button', class: 'btn btn--ghost btn--sm qz-undo', disabled: true,
      'aria-keyshortcuts': 'Backspace', text: api.t(S.orderUndo),
    });
    undoBtn.addEventListener('click', () => undo());

    function place(i) {
      if (done || chips[i].disabled) return;
      chips[i].disabled = true;
      chips[i].classList.add('is-used');
      placed.push(i);
      const slot = slots[placed.length - 1];
      slot.textContent = tokens[order[i]];
      slot.classList.add('is-filled');
      undoBtn.disabled = false;
      if (placed.length === tokens.length) { commit(); return; }
      (chips.find((c) => !c.disabled) || undoBtn).focus();
    }

    function undo() {
      if (done || !placed.length) return;
      const i = placed.pop();
      const slot = slots[placed.length];
      slot.textContent = '';
      slot.classList.remove('is-filled');
      chips[i].disabled = false;
      chips[i].classList.remove('is-used');
      undoBtn.disabled = placed.length === 0;
      chips[i].focus();
    }

    // The module's own key, as llms.txt says (digits are the engine's). It
    // honours the same guards NeoKeys would: nobody is typing, and the
    // visitor has not switched single-key shortcuts off.
    function onKey(e) {
      if (e.key !== 'Backspace' || done || isTyping(e) || shortcutsOff()) return;
      e.preventDefault();
      undo();
    }

    function commit() {
      done = true;
      const learner = placed.map((i) => tokens[order[i]]);
      const missAt = learner.findIndex((tok, k) => tok !== tokens[k]);
      const correct = missAt === -1;
      const chosen = learner.join(sep);
      undoBtn.disabled = true;
      chips.forEach((c) => { c.disabled = true; });
      if (correct) snapToLine();
      else {
        slots[missAt].classList.add('is-miss');
        slotList.classList.add('is-settled');
      }
      api.answer({
        itemId: item.id,
        correct,
        ms: timer.read(),
        chosen,
        expected: String(item.line),
        why: correct ? undefined : buildWhy(item, learner, missAt, api),
      });
      announce(api, round, { correct, n: round.index + 1, expected: item.line });
      api.next();
    }

    /** FLIP the boxed chips into one line of text. */
    function snapToLine() {
      const toks = tokens.map((tok) => el('span', { class: 'qz-line__tok', text: tok }));
      const line = el('div', { class: `qz-line${sep ? '' : ' qz-line--tight'}` }, [...toks, check()]);
      const firsts = slots.map((s) => s.getBoundingClientRect());
      slotList.replaceWith(line);
      if (reducedMotion()) return;
      const lasts = toks.map((t) => t.getBoundingClientRect());
      toks.forEach((t, k) => {
        t.style.transition = 'none';
        t.style.transform = `translate(${firsts[k].left - lasts[k].left}px, ${firsts[k].top - lasts[k].top}px)`;
      });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        toks.forEach((t) => {
          t.style.transition = 'transform 200ms var(--ease-out)';
          t.style.transform = 'none';
        });
      }));
    }

    document.addEventListener('keydown', onKey);
    root.append(
      prompt({ question: api.t(S.orderDescribe), id: qid }),
      slotList,
      bank,
      el('div', { class: 'qz-tools' }, undoBtn),
    );
    host.append(root);

    return {
      destroy() {
        done = true;
        document.removeEventListener('keydown', onKey);
      },
      focus() { chips.find((c) => !c.disabled)?.focus(); },
    };
  },
};
