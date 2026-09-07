// beats: count the beats (morae) of a loanword written in katakana.
//
// The options are four ascending numerals and the numeral is the key, so
// there are no keycaps: pressing 4 picks the tile that reads 4. That is the
// one exception to the keycap rule, and it is why the window never climbs
// past 9 (the engine binds digits 1 to 9). The why is the word cut into its
// beats, lit one after the other like a metronome, so a small っ or a ー gets
// the same tile as everything else. That equal width is the whole lesson.

import {
  S, el, uid, addStyle, itemRng, clock, prompt, optionsGroup, option,
  markCorrect, markWrong, markExpected, settle, announce, why, whyLine, gameRoot,
} from './shared.js';

const STYLE = `
.qz-tiles { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-3); }
.qz-tile { width: var(--tile, 64px); min-height: var(--tile, 64px); padding: 0; justify-items: center;
  font-size: 2rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.qz-tile .qz-check { right: 4px; top: 4px; width: 16px; height: 16px; translate: none; }
.qz-tile.is-correct .qz-opt__label { padding-right: 0; }
.qz-beats { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.qz-beat { width: 44px; display: flex; flex-direction: column; align-items: center; gap: var(--space-1); }
.qz-beat__kana { position: relative; width: 44px; height: 44px; display: grid; place-items: center;
  font-size: var(--text-xl); font-weight: 500; color: var(--text-primary); background: var(--surface-2);
  border-radius: var(--radius-sm); animation: qz-beat-on 220ms var(--ease-out) both; }
.qz-beat__kana::before { content: ''; position: absolute; inset: -2px; border: 2px solid var(--accent);
  border-radius: inherit; opacity: 0; animation: qz-ring 220ms var(--ease-out) both; animation-delay: inherit; }
.qz-beat__idx { font-size: var(--text-xs); color: var(--text-muted); font-variant-numeric: tabular-nums; }
.qz-why__romaji { font-size: var(--text-lg); color: var(--text-primary); letter-spacing: .02em; }
@keyframes qz-beat-on { from { background: var(--surface-2); color: var(--text-primary); } to { background: var(--accent); color: var(--bg); } }
@keyframes qz-ring { from { transform: scale(1); opacity: .8; } to { transform: scale(1.3); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .qz-beat__kana { animation: qz-beat-on 100ms both; animation-delay: 0ms !important; }
  .qz-beat__kana::before { animation: none; }
}
`;

/** Four ascending numerals containing beats, lowest at least 1, highest at most 9. */
export function numeralWindow(beats, rand) {
  const lo = Math.max(1, beats - 3);
  const hi = Math.min(beats, 6);
  const start = lo + Math.floor(rand() * (hi - lo + 1));
  return [start, start + 1, start + 2, start + 3];
}

/**
 * The why: the split as tiles with their index (the metronome), the romaji
 * the prompt withheld, then the rule's line when the set carries one. The
 * count sentence is not drawn in the panel, the tiles already say it; it is
 * kept as text for the results screen and the live region, so an item with
 * "explain": null still explains itself in words there.
 *
 * The romaji is required and never null (llms.txt), and it is printed exactly
 * as the set carries it: in macron style a long vowel is one letter with a
 * bar (kōhī), and each bar is one of the tiles above it. Spelling it back out
 * as koohii, or dropping the bar, would contradict the count just drawn.
 */
export function buildWhy(item, api) {
  const tiles = el('div', { class: 'qz-beats', role: 'list' }, item.split.map((piece, i) => {
    const kana = el('span', { class: 'qz-beat__kana', text: piece });
    kana.style.animationDelay = `${i * 220}ms`;
    return el('span', { class: 'qz-beat', role: 'listitem' }, [
      kana,
      el('span', { class: 'qz-beat__idx', text: i + 1 }),
    ]);
  }));
  const text = api.t(S.feedbackBeats, {
    kana: item.kana, n: item.beats, split: item.split.join('・'),
  });
  return {
    text,
    node: why([
      tiles,
      el('p', { class: 'qz-why__romaji', text: item.romaji || '' }),
      item.explain ? whyLine(api.t(item.explain), 'qz-why__line--rule') : null,
    ]),
  };
}

export default {
  id: 'beats',
  name: S.beatsName,
  describe: S.beatsDescribe,
  keys: [],

  mount(host, round, api) {
    addStyle('beats', STYLE);
    const item = round.items[round.index];
    if (!item) { api.next(); return { destroy() {} }; }

    const rand = itemRng(round, item);
    const timer = clock();
    const qid = uid('qz-q');
    const root = gameRoot('beats');
    const group = optionsGroup(qid, 'qz-tiles');
    const window_ = numeralWindow(item.beats, rand);
    let done = false;

    const tiles = window_.map((n) => {
      const btn = option({ label: n, key: n, cap: false, cls: 'qz-tile qz-opt--bare' });
      btn.addEventListener('click', () => pick(n, btn));
      return btn;
    });
    group.append(...tiles);

    function pick(n, btn) {
      if (done) return;
      done = true;
      const correct = n === item.beats;
      const expected = tiles[window_.indexOf(item.beats)];
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
        chosen: String(n),
        expected: String(item.beats),
        why: correct ? undefined : buildWhy(item, api),
      });
      announce(api, round, { correct, n: round.index + 1, expected: String(item.beats) });
      api.next();
    }

    root.append(
      prompt({
        main: item.kana,
        sub: item.word,
        question: api.t(S.beatsDescribe),
        id: qid,
        mainClass: 'qz-prompt__main--word',
      }),
      group,
    );
    host.append(root);

    return {
      destroy() { done = true; },
      focus() { tiles[0]?.focus(); },
    };
  },
};
