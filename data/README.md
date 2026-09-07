# The Quiz sets

The content is the product. It lives here as static JSON and nowhere else.
**No set entry ever goes inside a `.js` file.** The validator is code, the sets
are not.

The format is `neo-quiz-set/1`, and `llms.txt` at the site root is its
contract. This file does not restate it. It says where the sets come from, how
to regenerate them, and what could not be derived.

```
data/
  README.md              this file
  sets/index.json        neo-quiz-set-index/1, what the library lists
  sets/<id>.json         one neo-quiz-set/1 document per set, 25 of them
```

## Generated, not written

**Every file under `data/sets/` is emitted by
`projects/runcible-site/tools/build-sets.mjs`.** Do not hand edit one: the
next run overwrites it, and a hand edit that lands in one copy and not the
other is exactly the drift the generator exists to prevent. The generator lives
in Runcible because the corpus does (`runcible-site/data/`, its contract in
`runcible-site/data/README.md`), and it reads `tools/selection/sets.json`
there, which is the only file a person edits to change what ships.

```bash
cd projects/runcible-site
node tools/build-sets.mjs        # writes both copies, prints what it could not derive
make validate                    # Runcible's gates: banned songs, licence blocks, sizes, dashes
cd ../quiz-site
make validate                    # this site's gate: every set, then the index against its files
```

This is a manual data step, not a build. Nothing runs it for you, `make serve`
does not, and it is not in root `make smoke`. Running both validators is part
of the definition of done for any change here. `make validate` here is
composable the way Rappel's is: `validate-sets` is one `.PHONY` target plus a
bare `validate: validate-sets` line, and another validator is added with its
own pair of lines, never by editing that one.

Each set is written twice from one source: here, for the library, and under
`runcible-site/books/japanese/sets/` for the Runcible chapter that embeds it
over the `neo-quiz-embed/1` contract. The generator refuses to finish if the
two copies differ (`index.json` is written here only; Runcible has no library).
Runcible does not read those files until its `book.json` declares them in
`data[]`, which the host workstream does; a `src` that is not declared is a
load error naming `book.json`, the same rule as a deck.

The `version` on every set is `VERSION` in `build-sets.mjs`, a date bumped by
hand when the sets change. It is that file's own constant rather than the
corpus's `GENERATED_AT`, because a set changes when the generator changes and
not only when the corpus does: the yoon and extended rows moved no corpus
file. The contract wants a new date on any content change, and scores are
keyed by `id`, never by `version`.

## Where each set comes from

| Set | Game | Corpus source | Items | Licence |
|---|---|---|---|---|
| `jp-loanwords-beats` | beats | `loanwords/seed.json`, `loanwords/rules.json` | 58 | CC-BY-SA-4.0, screen required |
| `jp-hiragana-sound`, `jp-katakana-sound` | sound | `kana/hiragana.json`, `kana/katakana.json` | 102, 128 | public domain |
| `jp-hiragana-pairs`, `jp-katakana-pairs` | pairs | the same kana tables | 102, 128 | public domain |
| `jp-first-words-pairs` | pairs | `vocab/ch4.json` | 73 | CC-BY-SA-4.0, screen required |
| `jp-song-<id>-order`, 19 sets | order | `songs/<id>.json` | 2 to 8 each, 73 in all | public domain |

25 sets, 664 items.

**Item ids are derived from the corpus id of the record, never from its
position**, so a re-run over the same corpus emits the same ids. `quiz:answer`
carries the item id and Runcible stores it as evidence; an id that moves
between runs orphans every attempt a person made on that item, and nothing
would report it. A loanword id is `lw-` plus an ASCII transliteration of the
katakana (`lw-baggu`, `lw-koohii`, `lw-sandoicchi`), a kana id is the script
prefix plus the sound (`hira-ki`, `kata-wo`), a vocabulary id is the JMdict
slice's own (`w_0074`), a song line is song, verse and line
(`sakura-sakura-v1-l2`). The transliteration is for ids only, is not Hepburn
(a long vowel is doubled, a small ッ doubles the next consonant) and is never
shown to a learner; changing it moves every loanword id.

**beats.** The split is the corpus's own where the seed carries one (it does
for every word today) and otherwise mechanical from the katakana: one kana is
one beat, a small kana (ャ ュ ョ ァ ィ ゥ ェ ォ) joins the beat before it, and
ッ, ー and ン are beats of their own, which is the point. `rule` is the corpus's
pointer into `rules.json` (a singular `rule` on the seed word wins, then the
first of its `rules`, then the verified table's `en_source`). `explain` is
**the word's own `{ en, es }` line from `seed.json` when the teacher panel has
written one** (23 words: it says why this word has these beats, "Coffee came
from Dutch koffie long ago ..."), else **the rule's line from `rules.json`**
(35 words: it says what the rule does, "A stranded t or d takes o, not u ..."),
else `null`. The generator never writes a line of its own, so a word the
corpus leaves bare (pizza, banana) carries `"rule": null` and only the line the
panel gave it. Both sources cover Spanish, so every item has `es` today. The
58 words are the 40 seed entries plus the 18 verified strings the corpus pairs
with an English word; each of those carries its own romaji, rules and line, so
nothing is taken from a rule's example any more. Romaji is the researcher's line where the
corpus has one (all 58 today), shown only after the answer; 20 of them are
macron Hepburn (`kōhī`, `gēmu`, `pātī`), which does not spell out the count the
way `baggu` does, so on those the beat tiles carry the count and the romaji is
the reading. Where the corpus has no line the generator reads one off the
katakana through the kana tables (`hepburn()`: ー lengthens the vowel before it,
ッ doubles the consonant after it and `ch` is written `tch`, ン is `n` and `n'`
before a vowel or y, a digraph is its base's onset plus the small kana's vowel),
so `romaji` is never null and a kana the tables cannot read fails the build
instead of shipping a guess. That fallback is not a path nobody runs: every run
re-reads the 58 corpus lines the same way and prints any disagreement, and
today it reproduces all 58 (`sandoitchi`, `shoppingu`, `akushon`, `rajio`,
`terebijon`, `baiorin`, `uisukī` among them). `television`
appears twice on purpose: テレビ (3 beats) and テレビジョン (5) are both in the
corpus and have distinct ids.

**sound.** The gojuon rows, the dakuten rows, the yoon rows and, in katakana,
the extended digraphs, `row` and `column` carried so the feedback strip can
draw the row and `?filter=row:k` can cut a round down to one. Hiragana is 102
kana in 27 rows, katakana 128 in 42.

A yoon row is labelled by its onset as Hepburn writes it (`ky`, `sh`, `ch`,
`ny`, `hy`, `my`, `ry`, `gy`, `j`, `by`, `py`), which is its reading without the
vowel, and holds the three columns `ya`, `yu`, `yo`: きゃ is `kya`, row `ky`,
column `ya`. Eleven rows per script, 33 kana.

An extended katakana digraph is read as its base's onset plus the small kana's
vowel, the corpus carrying `romaji: null` for every one of them, and then it
lands where the chart has room. It joins its base's row where that row's cell
is empty (ヴァ ヴィ ヴェ ヴォ beside ヴ, so `v` is a five-cell row) and otherwise
opens a row named by the base's own reading: `fu` (ファ フィ フェ フォ), `tsu`
(ツァ ツィ ツェ ツォ), `u` (ウィ ウェ), `te` (ティ), `to` (トゥ), `de` (ディ),
`do` (ドゥ), `shi` (シェ), `ji` (ジェ), `chi` (チェ). One with a small ャ ュ ョ
goes to the yoon row of its onset: `dy` (デュ), `ty` (テュ), `fy` (フュ), `vy`
(ヴュ). The cell is judged full or empty against the **chart**, not against the
set, which is why ディ opens a `de` row rather than filling the d row's `i`
cell: that cell is ヂ's, even though ヂ is too rare to ask about. 25 of the 33
extended entries ship; the other eight are in "what could not be derived".

を and ヲ take the sound `wo` (the corpus accepts `o` and `wo`; `o` belongs to お) because the
engine cannot ask "which kana makes o" when two do; the validator fails a set
with two kana on one sound. Where the corpus lists glyphs learners confuse
(さ き, ぬ め, わ れ ね, る ろ, シ ツ, ソ ン) the item carries `distractors`
led by those, filled from the same row; every other item leaves the engine to
its own row-or-column pick. ン and ん carry `column: null`, the only kana
allowed to.

**pairs.** Kana to romaji is the same record set with nothing else on the
board, and each item carries `row` and `column` as its sound sibling does, so
one row of the chart is one board. Word to meaning puts the JMdict headword on
the left (kanji where the entry has it) and the first JMdict meaning that is
unique on the board on the right, the parenthetical stripped when that is
enough and kept when it is what makes the meaning unique
(`thank you (for the meal)`). **The reading is never on the board**: for a
kanji headword it is the `note`, shown only in the feedback after a miss. The
format refuses a pair where either side contains the other after trim,
casefold and strip-accents, and a set where two rights fold to the same
string, per language.

Every first-words pair carries its `group`, the rung of chapter 4 the word sits
in (`greetings`, `numbers`, `days`, `counters`, `everyday`), and the set
declares those five in `groups` with the corpus's own words, so
`?filter=group:days` is a seven-day board with "Days and when" in the round
header. `right.es` is the Spanish for the meaning that pair actually shows,
written in `tools/selection/sets.json` under `meanings_es` and keyed by the
vocabulary's word id; all 73 carry one. The generator translates nothing
itself, and it drops a Spanish line to null rather than shipping it if it would
put two identical rights on one Spanish board or put the left side on the
board.

**order.** One item per line, the pieces cut on the word boundaries of the
corpus's own romaji line (`romaji_lines`) aligned back onto the kana: each
romaji word becomes hiragana through the vendored wanakana and is matched in
turn against the kana with the spaces removed (the particles `wa`, `o`, `e`
also try は, を, へ; Hepburn `zu` and `ji` also try づ and ぢ). The corpus's own
kana line has a space only at the phrase break, and a two-piece line is a coin
flip, which is why the romaji's boundaries are used (design review,
2026-09-05). Three joins follow, none a judgment about Japanese: a one-kana
piece joins the piece before it (ここ + は = ここは), a piece repeated straight
after itself becomes one piece (`よい よい`), and a piece that still reads the
same as another joins the piece before it, so no two chips read the same and
there is one right order. A line whose romaji does not align (だぁれ written
`daare`) falls back to the corpus's spaces and is reported; a line left with
fewer than three pieces is skipped and reported (toryanse line 1 is a repeat
of one word; furusato line 4, zui zui line 3, nanatsu line 2 and kagome line 2
are two words). 73 of the 78 lines survive: 28 with three pieces, 34 with
four, 10 with five, one with seven. `line` is the pieces joined with a space,
`gloss.en` the researcher's verse gloss, one per verse and shown on every line
of it. `gloss.es` is that gloss in Spanish from the `glosses_es` hook in
`tools/selection/sets.json`, keyed by song id and then verse number; all 20
verses of the 19 songs carry one, so no order item falls back today. A verse the
hook does not name ships `"es": null`, which is what puts the honesty line under
the surface for a Spanish reader.

## Licence

**Derived data inherits the licence of its source, not this repo's MIT.** The
loanword seed and the vocabulary slice are JMdict-derived, so those two sets
are CC BY-SA 4.0 with `screen: "required"` and the EDRDG acknowledgement in
EDRDG's own wording, which the engine renders under the round on every screen
that shows the set, embed included. Do not improve that sentence; it is
quoted, not written. The kana tables and the nineteen songs are public domain
with `screen: "none"`; a song set still carries the credits with the authors'
death years and both verdicts (Japan and the US) in `_licence`, copied from
the song file, because those years are the whole basis of the verdict, and its
`licence.attribution` names the lyricist, the composer and the first
publication even though nothing obliges the screen to show it.

The beats explain lines have two sources with two credits. A rule's line is
`rules.json` prose, credited to Wikipedia and the Agency for Cultural Affairs
notices, and while any item uses one the generator appends that
acknowledgement to the set's `attribution` (it does today). A word's own line
is `seed.json` prose and is covered by that file's EDRDG block. Nothing in
this directory uses Tatoeba: the four games take no sentence.

## What could not be derived

Printed by every run, recorded here so nobody re-opens it from memory.

- **Beats, 28 verified strings with no English word** in the corpus
  (サッカー, レストラン, エレベーター ... コンビニエンスストア). A beats item shows
  the source word under the kana before the answer, so without one there is no
  item. The seven verified words that once lacked romaji (sandwich, shopping,
  action, radio, television, violin, whisky) carry the teacher panel's own line
  now and are in the set; the tables would have read the same seven strings.
- **Sound and pairs, ぢ, づ, ヂ, ヅ**: flagged rare in the corpus and sounding
  identical to a z-row kana, so the d row shows three cells in the strip.
- **Sound and pairs, ウォ**: it reads `wo`, and ヲ already owns `wo` (Hepburn
  writes を as `o`, which お has). The engine cannot ask "which kana makes wo"
  when two do, and between a chart kana and a loanword digraph the chart kana
  keeps the sound, so the `u` row is two cells (ウィ ウェ) rather than three.
- **Sound and pairs, クァ クィ クェ クォ グァ**: read through the tables they are
  `ka`, `ki`, `ke`, `ko` and `ga`, which the k and g rows own. A digraph whose
  sound a plain kana owns is left out, by contract.
- **Sound and pairs, イェ**: its base イ is a bare vowel and gives no onset, so
  the tables read no sound for it. ウ is the one vowel base the contract reads
  as an onset, in the `u` row it opens, and nothing licenses reading イ as `y`.
  It is the one extended entry with no row in `llms.txt`, which lists ten new
  rows and no `i`. Add it only by amending the contract first.
- **Sound and pairs, the single ヴ in the extended table**: already the v row's
  kana. The extended table lists it as a spelling, not as a new sound.
- **Pairs, おはようございます and ありがとうございます**: every meaning JMdict
  gives them is already the meaning of the shorter form on the board.
- **Order, five song lines**: four are two pieces once repeats are joined
  (Furusato line 4, Zui Zui line 3, Nanatsu no Ko line 2, Kagome Kagome line 2)
  and one is a single piece (Toryanse line 1, a word repeated). Two pieces is a
  coin flip, so neither is a puzzle. One more line is cut on the corpus's spaces
  rather than the romaji's words, and says so (Zui Zui line 6, だぁれ written
  `daare`).
- **Spanish on the group labels.** `groups` carries the corpus's own words for
  the five rungs, and three of them are missing their accents: `Numeros`,
  `Dias y cuando`, `Sustantivos de cada dia`. They are authored in
  `runcible-site/tools/selection/vocab.json`, not here, and chapter 4 already
  spells the same label `Sustantivos de cada día`. Fixing them there and
  re-running `build-vocab.mjs` and then `build-sets.mjs` carries the accents
  across; writing them into `sets.json` instead would put the same string in two
  files and let it drift.
- **Nothing else is untranslated.** Every first-words meaning and every song
  gloss now carries Spanish. A song's `name` is still the Japanese title with
  its romaji rather than a translation, because the corpus gives no English
  title, and a set whose name or gloss falls back is what the honesty line
  under the surface is for.

## Rolling back

Every output is committed JSON. A bad run is `git diff` then `git checkout` on
`data/sets/` here and `books/japanese/sets/` in Runcible; there is no state
anywhere else.
