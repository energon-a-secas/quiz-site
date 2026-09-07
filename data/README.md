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

The `version` on every set is `GENERATED_AT` from
`runcible-site/tools/lib/corpus.mjs`, the one date the whole corpus run
carries, the same way the decks take theirs. Bump it there when a corpus change
is regenerated after the sets have shipped; the contract wants a new date on
any content change, and scores are keyed by `id`, never by `version`.

## Where each set comes from

| Set | Game | Corpus source | Items | Licence |
|---|---|---|---|---|
| `jp-loanwords-beats` | beats | `loanwords/seed.json`, `loanwords/rules.json` | 58 | CC-BY-SA-4.0, screen required |
| `jp-hiragana-sound`, `jp-katakana-sound` | sound | `kana/hiragana.json`, `kana/katakana.json` | 69, 70 | public domain |
| `jp-hiragana-pairs`, `jp-katakana-pairs` | pairs | the same kana tables | 69, 70 | public domain |
| `jp-first-words-pairs` | pairs | `vocab/ch4.json` | 73 | CC-BY-SA-4.0, screen required |
| `jp-song-<id>-order`, 19 sets | order | `songs/<id>.json` | 2 to 8 each, 73 in all | public domain |

25 sets, 482 items.

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
nothing is taken from a rule's example any more. Romaji is the researcher's,
shown only after the answer; 20 of them are macron Hepburn (`kōhī`, `gēmu`,
`pātī`), which does not spell out the count the way `baggu` does, so on those
the beat tiles carry the count and the romaji is the reading. `television`
appears twice on purpose: テレビ (3 beats) and テレビジョン (5) are both in the
corpus and have distinct ids.

**sound.** The gojuon rows and the dakuten rows of each script, `row` and
`column` carried so the feedback strip can draw the row. を and ヲ take the
sound `wo` (the corpus accepts `o` and `wo`; `o` belongs to お) because the
engine cannot ask "which kana makes o" when two do; the validator fails a set
with two kana on one sound. Where the corpus lists glyphs learners confuse
(さ き, ぬ め, わ れ ね, る ろ, シ ツ, ソ ン) the item carries `distractors`
led by those, filled from the same row; every other item leaves the engine to
its own row-or-column pick. ン and ん carry `column: null`, the only kana
allowed to.

**pairs.** Kana to romaji is the same record set with nothing else on the
board. Word to meaning puts the JMdict headword on the left (kanji where the
entry has it) and the first JMdict meaning that is unique on the board on the
right, the parenthetical stripped when that is enough and kept when it is
what makes the meaning unique (`thank you (for the meal)`). **The reading is
never on the board**: for a kanji headword it is the `note`, shown only in the
feedback after a miss. The format refuses a pair where either side contains
the other after trim, casefold and strip-accents, and a set where two rights
fold to the same string.

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
are two words). 73 of the 76 lines survive: 27 with three pieces, 35 with
four, 10 with five, one with seven. `line` is the pieces joined with a space,
`gloss.en` the researcher's verse gloss. `gloss.es` is null: the corpus carries
no Spanish and this generator does not translate. `tools/selection/sets.json`
has a `glosses_es` hook keyed by song and verse for whoever writes them.

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
  action, radio, television, violin, whisky) now carry it and are in the set.
- **Sound and pairs, the yoon digraphs** (きゃ ... ぴょ, 33 per script): their
  column would be ya, yu or yo, which the row strip has no place for.
  **The extended katakana digraphs** (ティ, ファ ...): the corpus carries
  `romaji: null` for them on purpose. **ぢ, づ, ヂ, ヅ**: flagged rare in the
  corpus and sounding identical to a z-row kana, so the d row shows three
  cells in the strip.
- **Pairs, おはようございます and ありがとうございます**: every meaning JMdict
  gives them is already the meaning of the shorter form on the board.
- **Order, two song lines that are a single piece** on the corpus's
  boundaries (Nanatsu no Ko line 2, Kagome Kagome line 2): nothing to order.
- **Spanish** on song glosses and on the vocabulary meanings: the corpus is
  English-glossed. Set names are bilingual; song names are the Japanese title
  with the romaji, not translated.

## Rolling back

Every output is committed JSON. A bad run is `git diff` then `git checkout` on
`data/sets/` here and `books/japanese/sets/` in Runcible; there is no state
anywhere else.
