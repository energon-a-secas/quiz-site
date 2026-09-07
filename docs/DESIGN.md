# Quiz: design

Visual and interaction design for quiz.neorgon.com. Register: product (the tool
disappears into the round). It renders the contract in `llms.txt`, which wins.

## 1. Identity

- **Scene.** A learner on a phone, on a train, in the evening, one thumb free,
  about forty seconds between stops. The fleet ground (`--bg` from CDN
  `base.css`) is dark and the scene agrees with it; nothing is overridden.
- **Colour strategy: Restrained.** Fleet neutrals, one accent. The two local
  knobs are `--accent: #fb923c` and `--accent-bright: #fdba74` in
  `css/style.css`; no other token is redeclared. The accent marks the current
  pick, the right answer, focus, the streak ring and filled progress. Never decoration.
- **Verdict colours.** `--danger` (the scaffold's) for a wrong pick, `--accent`
  for the right one. No green. A wrong pick is a 2px border, never a filled red
  box, so after a miss the loudest thing on screen is the right answer.
- **Anchor references.** A metronome (beats light in time), a kana chart (the
  sound feedback is one row of the chart), fridge magnets (order chips).
- **Anti-goals.** Not Proctor: no timer bar, no percent grade, no exam
  register. No confetti, mascot, emoji, gradient text or card inside a card.
  Numbers that look like options are the defect this site exists to fix.

## 2. Type scale

One family, `--font` from base.css. Fixed rem steps, no fluid headings, and
adjacent steps differ by at least 1.125 so nothing reads as flat.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Prompt glyph (sound: one kana) | 4rem | 500 | `line-height: 1`, centred |
| Prompt word (beats: katakana) | 2.25rem | 500 | wraps only past 12 kana |
| Prompt line (order: the filled line) | 1.5rem | 500 | wraps freely |
| Option label | `--text-lg` | 500 | kana and romaji options: `--text-xl` |
| Beats numeral tile | 2rem | 600 | `font-variant-numeric: tabular-nums` |
| Round header, progress, streak | `--text-sm` | 500 | `--text-secondary` |
| Feedback title / body | `--text-xl` / `--text-base` | 600 / 400 | body max 65ch |
| Keycap digit | `--text-xs` | 600 | tabular-nums |
| Library game name | `--text-2xl` | 600 | |

## 3. The round surface

One column, `max-width: 640px`, centred, `padding: var(--space-6) var(--space-4)`.
Top to bottom: **round header**, **prompt**, **options** (the feedback panel
appears under them, never in their place), **attribution** (only when the
licence says `screen: "required"`). No card around it; the page is the surface.

- **Round header.** Game name left (then a middle dot and the filter in
  words when the round is filtered, section 3.3), `progress` centre, streak
  right (hidden until 3). Under it the progress track: `total` segments 4px
  tall with 2px gaps, a correct segment filled `--accent`, a missed one
  `--danger` at 60% opacity, unplayed ones `--surface-2`. The track is the
  round's history.
- **Prompt.** The thing being asked, then the question line in
  `--text-secondary`. The question line is the game's `describe` string (or
  the per-direction string in sound).
- **Options.** One `<div role="group" aria-labelledby="{question line id}">`.
  Each option is a `<button type="button">` of min-height `--control-height`,
  `--surface-1` fill, 1px `--border`, `--radius`. States: hover `--surface-2`;
  focus-visible 2px `--accent-bright` outline, offset 2px; active
  `translateY(1px)`; after an answer every option is disabled at opacity .6
  except the chosen and the expected; correct `--accent` fill with `--bg` text;
  wrong 2px `--danger` border, text unchanged.

### 3.1 Keycaps

An ordered keycap is a **separate box beside the option**, never text in it:
a grid `28px 1fr`, gap `--space-3`; the keycap a 28px square, `--surface-2`
fill, 1px `--border-strong`, `--radius-sm`, the digit `--text-xs` 600 tabular,
`aria-hidden="true"`. The button carries `data-key="3"` (the engine dispatches
the digit to it) and `aria-keyshortcuts="3"`; the `?` sheet lists digits once.

- `3.` or `3)` inside an option's text is a defect, in any game or language.
- **When the options are themselves numerals (beats), there are no keycaps.**
  The numeral is the key: pressing `4` picks the tile that reads 4. Tiles are
  64px squares in one row, gap `--space-3`.
- Keycaps are numbered by position in the answerable group and never renumber
  while that group is on screen. In **pairs** they sit on whichever column is
  answerable now (left, then right). In **order** a used chip leaves a dimmed
  ghost in its bank slot, so key `3` means the third chip all round.

### 3.2 The feedback panel

After a **wrong** answer the options stay, greyed, the chosen one with a
`--danger` border and the expected one filled `--accent`, and a panel rises in
under them: `--surface-1`, 1px `--border`, `--radius-lg`, padding `--space-4`
`--space-6`. Contents, in order:

1. Title `feedback.wrong`.
2. The **what**: `feedback.answerWas` followed by the expected answer in the
   option's own type size. Skipped when the why already shows the whole
   expected answer (order's marked line), so a fact is never stated twice.
3. The **why**: the game's own explanation (section 4). This is the block the
   site exists for; it is never a single word, and it does not restate in a
   sentence what its picture already shows.
4. One `.btn--primary`, `feedback.continue`, `aria-keyshortcuts="Space Enter"`
   (full width under 480px).

The programmatic focus on the title draws the focus ring around the words
only (`width: fit-content`), not the column.

In pairs the panel lists every pair missed on the board. After a **correct**
answer there is no panel: the option fills, the check draws, `#quiz-progress`
says `live.correct`, and the next item arrives after 600ms (300ms under reduced
motion). Every miss is read back on the results screen with the same why line.

### 3.3 A filtered round

`?filter=` (grammar in `llms.txt`) narrows the round to the items matching one
field. The header names it in words after the game name: `filter.row` for one
row (the k row), `filter.rows` for several (the k and s rows; the list joins
with commas and `filter.and`), the group's own name from the set's `groups`
for `group:`, and `filter.other` for any other label (column: i). Wherever
`{row}` prints, `row.vowels` and `row.moraic-n` replace those two labels and
every other row prints as written (k, ky, fu). The track counts the filtered
round; the strip and the distractors still draw from the whole set
(`round.pool`), so a round on the k row shows all five cells. Nothing else
changes: same options, feedback and score key. An unknown field or an empty
match shows `error.filter` in `#quiz-verdict` like every `error.*` and posts
`filter-empty`. The library is never filtered.

## 4. Per game: prompt, options, why

**beats.** Prompt: the katakana (`kana`) large, the source `word` under it in
`--text-secondary`. Romaji is **not** shown before the answer: `baggu` spells
out the count. Options: four ascending numerals containing `beats`, window
chosen by seed, lowest at least 1, no keycaps. Why: `split[]` as tiles 44px
wide with the beat index under each in `--text-xs`, then `romaji` (macron
style, printed as the set carries it), then the rule's one line (`explain`).
Tiles light in sequence like a metronome, and a small っ or ー gets the same
width as the rest, which is the point. Why line: `feedback.beats`, read on the
results screen and in the live region; the panel does not print it, the
indexed tiles are the count.

**sound.** Direction per item by seed: kana shown, pick the sound
(`sound.toSound`); or sound shown, pick the kana (`sound.toKana`). Four
options in a 2x2 grid (one column below 480px), keycaps 1 to 4. Distractors:
the item's `distractors`, else three sounds from the same row or column in the
set. Why: a strip of the kana's **row**, built from the set's items sharing
`row`, in column order a i u e o, or ya yu yo for a yoon row: as many cells as
the row has kana (five, three for ky, four for fu), no empty cell drawn; the
target filled `--accent`, the others `--surface-2`; the row label left of the
strip as the set writes it, the `column` under the target (i, or ya). Why
line: `feedback.sound`, with the `{row}` words of section 3.3.

**pairs.** A board of four pairs: left column `left`, right column `right` in
the reader's language (`api.t()`, English with the honesty line of section 11
when `"es"` is null; a bare romaji string is neither and never trips it), the
right column shuffled by seed. The board is the prompt; the question line
is `pairs.prompt`. Tap a left item (keycaps 1 to 4 on the left), then a right
item (keycaps move right). Three states, three shapes: the picked left item is
an accent tint at 18% (selection), focus is the ring (you are here), a match
locks both with a quiet accent border at opacity .8, and a left item that was
missed first keeps a `--danger` border once it locks, so the board still shows
where the miss was. A mismatch gives the left item a `--danger` border for one
attempt. **Nothing but `left` and `right` is on the board**: no romaji, no
gloss, no note, and the format refuses a pair where either side contains the
other. Why (per missed pair, when the board completes): the pair side by side,
then `note` under the `pairs.reading` label when present. `feedback.pairs` is
the results row and the live region, not a line under the pair.

**order.** Prompt: a row of empty slots (`tokens.length`), then the bank of
shuffled chips with keycaps 1 to N, N at most 9 (the format caps it). Tapping
a chip moves it to the next slot; Backspace or `order.undo` returns the last
one. The answer commits when the last slot fills. Why: the correct `line`
with the **first misplaced token** outlined in `--danger` and the learner's
token hanging under it, struck through, so the line stays one line; then
`gloss` in the reader's language under the `order.gloss` label (English, and
the honesty line, when `"es"` is null). The marked line is the what and the
why, so the panel skips `feedback.answerWas` for this game; `feedback.order`
is the results row and the live region. On correct the chips slide into one
line (section 7). The format wants 3 to 9 pieces with no two equal: two is a
coin flip and two identical pieces have no wrong order.

## 5. Timing and streaks

- `ms` runs from the game's first paint to the commit (in pairs, from the
  previous lock). It is recorded and reported, never raced: no countdown.
- Streak counts consecutive correct answers. From 3 it shows in the round
  header as `streak.count` beside an 8px filled `--accent` dot (an empty ring
  read as an unselected radio); at 5 and every 5 after, the dot scales 1 to
  1.15 and back once (200ms, transform only).
- A round is `limit` items, default 10, minimum 1, maximum the set's length.

## 6. Results screen

Same column. Title `results.title` (`results.perfect` for a clean round), then
`results.score`, then `results.median` and `results.streak` in
`--text-secondary`. The progress track replays its segments left to right, 40ms
apart, once. Then `results.misses`: each miss as a row with the prompt (in
order, the learner's own line, never the gloss), the expected answer and its
why line; kana break only at the spaces between pieces. Then `results.again`
(`.btn--primary`, same set, new seed) and, standalone, `results.change`
(`.btn--ghost`, to the library), replaced in embed by the `embed.open` link.
Focus lands on the title.

A round left early in embed (Leave in the quit prompt) shows the same screen
titled `results.partial` with the score out of what was answered, the track
still showing the unplayed segments, and records no score: one right answer
then Leave is not a 1/1 best. Standalone, Leave goes back to the library.

## 7. Motion

Every animation reports a state change; the game moments below are where the life is.

| Moment | Motion | Duration, easing |
|---|---|---|
| Correct pick | option fills `--accent`; a 20px check draws via `stroke-dashoffset` | 150ms, then 200ms, `--ease-out` |
| Wrong pick | border to `--danger`; one 4px horizontal nudge and back | 120ms |
| Next item | prompt and options fade out; next fades in with an 8px rise | 150ms out, 200ms in |
| Feedback panel | opacity 0 to 1 with an 8px rise | 200ms |
| Beats tiles | light in sequence, each with a soft ring scaling 1 to 1.3 and fading | 220ms each, once |
| Sound strip | cells light left to right, the target stays lit | 80ms each |
| Order snap | chips translate into one line (FLIP) | 200ms |
| Streak ring | scale 1 to 1.15 to 1 | 200ms |

No bounce (`--ease-snap` is never used), no layout property animated, no load
choreography. Under `prefers-reduced-motion: reduce` every entry above becomes
a 100ms opacity change; the beats tiles and the sound strip light all at once;
the check still draws (a 200ms stroke on a 20px icon).

## 8. Keyboard and screen reader

- **Keys.** Digits `1` to `9` answer (the keycap's digit, or the numeral
  itself in beats). `Space` or `Enter` continues after feedback. `Backspace`
  undoes in order. `Esc` asks `quit.title` inline under the round header (two
  buttons, no modal). `R` restarts (NeoKeys conventional). `?`, `H` and `G`
  are the kit's, never rebound; in embed there is no `H`. All of it goes
  through NeoKeys, so its typing guard and WCAG 2.1.4 remap panel apply.
- **Focus order.** Header kit, round header (the streak is not focusable),
  options in reading order, attribution link, footer. After a wrong answer
  focus moves to the panel's title (`tabindex="-1"`); Tab reaches Continue.
  After Continue, focus moves to the new item's first option. On the results
  screen focus moves to the title.
- **Live regions.** `#quiz-progress` (`aria-live="polite"`): `live.progress`
  per item, `live.correct` after a correct answer, and `api.say()` text.
  `#quiz-verdict` (`aria-live="assertive"`, `role="alert"`): `live.wrong` after
  a wrong answer and every `error.*`.
- **Names.** An option's accessible name is its text only; the keycap is
  hidden and `aria-keyshortcuts` carries the digit. A locked pair gets
  `aria-pressed="true"`. Order slots are an `<ol aria-label="order.line">`, the
  bank a group labelled `order.bank`. The progress track is
  `role="img"` with `progress` as its label.
- **Contrast.** `--text-primary` on `--bg` and `--bg` on `--accent` both clear
  4.5:1; `--danger` is only ever a border or a label beside text.

## 9. Responsive

| Width | Change |
|---|---|
| >= 940px | column stays 640px; the library shows the set picker beside each game |
| <= 700px | the header kit collapses its own controls; nothing here to collapse |
| <= 480px | sound options one column; keycaps 24px; beats tiles 56px; pairs columns `1fr 1fr` with `--space-2` gap; surface padding `--space-4` `--space-3` |
| <= 360px | prompt glyph 3rem, prompt word 1.75rem |

Touch targets are never under 44px. Nothing scrolls horizontally: order chips
wrap, the beats strip wraps past eight tiles.

## 10. Embed mode

`?embed=1` hides the header kit, footer kit, beacon and skip link
(`body.is-embed`, Rappel's selector list) and mounts a bar: `--surface-1`, 6px
`--space-4` padding, 1px `--border` below, `--text-xs`; the set name left
(then the filter words, section 3.3, when filtered), `embed.open` right as
`<a target="_blank" rel="noopener noreferrer">` to the same URL without
`embed` and `skill`, `filter` kept. Surface padding drops to `--space-4`.
The round starts on load; `quiz:start` restarts it. When the frame is not
persisting (`store: "ephemeral"`, see `llms.txt`) one line of `embed.notSaved`
sits under the bar in `--text-muted`. Attribution renders as in standalone.

## 11. The library (standalone)

The home screen. Title `library.title` (an `h2`: the header kit owns the
page's `h1`) with the round length beside it, once: `library.roundLabel` and
three `.btn--ghost.btn--sm` toggles reading 5, 10 and 20 (`aria-pressed`,
`library.round` as the accessible name). It is one preference for every game,
so it is one control and not a copy per row. Then the four games as a
**list**, not a grid, rows separated by 1px `--border-subtle`. A row is: the
game name (`--text-xl`, a step under the title), its `describe` line, the set
picker (`library.set`, a native `<select>` over the built-in index filtered to
that game, `library.items` after each name), the last score from
`quiz:scores:v1` (`library.last` or `library.unplayed`), and `library.play`.
The keys are not repeated per row; the `?` sheet lists them once. The last
played game is first. While a set fetches, the surface shows a skeleton of the
header and four option rows.

**The honesty line.** When the reader's language is Spanish and anything on
the screen fell back to English (a song name, a gloss or a pairs `right`
with `"es": null`),
one line of `lang.fallback` in `--text-sm` `--text-secondary` sits under the
surface, once per screen (CONTRACTS convention 2). It never shows in English.

**Attribution.** When the set's licence says `screen: "required"`, one line
stays visible under the surface on every screen that shows the set: the
attribution's first sentence in the licensor's own words, clamped to one line,
with `attrib.more` as the disclosure; the rest of the attribution and the
`attrib.source` link open under it (`<details>`, the footer kit's own
disclaimer rule). The acknowledgement is on screen without being the largest
block of text beside the prompt.

## 12. Strings

Every learner-facing string is an `{ en, es }` pair in `js/strings.js`,
resolved with `api.t()`; placeholders are `{name}`. That file is the list and
where the Spanish is reviewed: this section carried a copy until 2026-09-07
and was already a key behind (`error.boot`). It now lists only the title tag
and meta description (English only) and the keys the filtered round adds.

| Key | en | es |
|---|---|---|
| title tag | Quiz \| Four small games for kana, beats and song lines | (English only) |
| meta description | Count the beats of a loanword, pick the sound of a kana, match pairs and put a song line back in order, in rounds short enough to finish on a train | none |
| filter.row | the {row} row | la fila {row} |
| filter.rows | the {list} rows | las filas {list} |
| filter.and | and | y |
| filter.other | {field}: {list} | {field}: {list} |
| row.vowels | vowel | de las vocales |
| row.moraic-n | ん | ん |
| error.filter | Nothing in this set matches {filter}. Check the field and its values. | Nada en este conjunto coincide con {filter}. Revisa el campo y sus valores. |
