# CLAUDE.md: Quiz

Four small games that teach one thing at a time: count the beats of a loanword,
pick the sound of a kana, match two columns, put a song line back in order. One
JSON set per game, a round of 5, 10 or 20 items, and a picture before a sentence
on every wrong answer. It is the small-stuff complement to Proctor, not an exam.
Any site can embed a game in an iframe and read the answers back over
`postMessage`; that is how Runcible attaches a game to a chapter and counts each
answer as evidence. Nothing is uploaded and no account exists.

**Live:** quiz.neorgon.com · **Port:** 8880

## Run

```bash
make serve       # http://localhost:8880
make validate    # every set, then the index against its files. Plain node, no install
```

Then open http://localhost:8880. It must be served over HTTP. The app is ES
modules, and `file://` blocks them.

`make validate` is one `.PHONY` target (`validate-sets`) plus a bare
`validate: validate-sets` line, the composable shape Rappel uses: add a
validator by adding a target and one more such line, never by editing that one.
Nothing runs it for you and it is not in root `make smoke`, so running it is
part of the definition of done for any change under `data/` or `js/`.
`node tools/test-origin.mjs` is the allowlist suite and is not wired into
`validate` yet; run it by hand after any change to `js/origin.js`.

## Contracts

- `llms.txt` at the site root is the contract and it wins over every other doc
  here: the `neo-quiz-set/1` set format, the `neo-quiz-embed/1` message
  vocabulary, the URL parameters, the game module interface and the two storage
  keys. `docs/DESIGN.md` renders that contract as visual and interaction design.
- `data/README.md` says where the sets come from, what could not be derived, and
  how to roll a bad generation back.
- `docs/delivery/CONTRACTS.md` C1 to C3 (monorepo) is the Book format Runcible
  reads; the quiz exercise is `{ type: "quiz", game, src, skill, limit? }`.

## Architecture

![Architecture](docs/architecture.svg)

| Module | Lines | Owns |
|---|---:|---|
| `js/games/shared.js` | 362 | `S`, `el`, `uid`, `addStyle`, `reducedMotion` |
| `js/neokeys/core.js` | 274 | `RESERVED`, `CONVENTIONAL`, `onChange`, `setTypingSelector`, `isTypingTarget` |
| `js/neorgon-beacon.js` | 263 | none (kit) |
| `js/round.js` | 261 | `createRound` |
| `js/render.js` | 231 | `relabelChrome`, `refreshLangNote`, `renderSkeleton`, `renderLibrary`, `renderError` |
| `js/router.js` | 214 | `route`, `boot` |
| `js/games/order.js` | 213 | `separatorOf`, `bankOrder`, `buildWhy` |
| `js/validate-set.js` | 206 | `GAMES`, `COLUMNS`, `fold`, `validateSet`, `firstError` |
| `js/games/pairs.js` | 204 | `shuffledRights`, `facesOf`, `buildWhy` |
| `js/games/sound.js` | 183 | `poolOf`, `directionFor`, `distractorsFor`, `rowOf`, `buildWhy` |
| `js/neokeys/overlay.js` | 182 | `open`, `close`, `toggle` |
| `js/embed.js` | 173 | `PROTOCOL_VERSION`, `CONTRACT`, `readConfig`, `resolveHostOrigin`, `post` |
| `js/utils.js` | 160 | `$`, `escHtml`, `h`, `append`, `clear` |
| `js/neorgon-persist.js` | 152 | `safeGet`, `safeSet`, `safeRemove`, `safeGetJSON`, `safeSetJSON` |
| `js/sets.js` | 152 | `BUILTIN_INDEX`, `MAX_BYTES`, `SetError`, `loadBuiltinIndex`, `builtinEntry` |
| `js/strings.js` | 145 | `STRINGS`, `beginPage`, `hadFallback`, `onFallback`, `t` |
| `js/games/beats.js` | 143 | `numeralWindow`, `buildWhy` |
| `js/neokeys/fleet.js` | 139 | `setSource`, `open`, `close`, `toggle`, `count` |
| `js/origin.js` | 122 | `isNeorgonHost`, `isLocalOrigin`, `isAllowedOrigin`, `isAllowedSetSrc`, `namespacedSetId` |
| `js/neokeys/chrome.js` | 118 | `isHidden`, `setScope`, `isFull`, `show`, `hide` |
| `js/neokeys/index.js` | 116 | `init` |
| `js/state.js` | 105 | `PREFS_KEY`, `SCORES_KEY`, `ROUND_SIZES`, `DEFAULT_LIMIT`, `state` |
| `js/ui.js` | 102 | `keycap`, `focusFirstOption`, `progressTrack`, `streakBadge`, `feedbackPanel` |
| `js/keys.js` | 101 | `initKeys`, `registerGameKeys` |
| `js/neokeys/store.js` | 88 | `enabled`, `open`, `toggle` |
| `js/games/index.js` | 48 | `GAMES`, `GAME_IDS`, `GameLoadError`, `loadGame` |
| `js/app.js` | 18 | none |
| `js/neokeys/boot.js` | 18 | none |

Vendored from `packages/neorgon-ui/`: never edit in place, run the sync script
instead: `js/neorgon-header.js`, `js/neorgon-footer.js`.

`js/app.js` wires and decides nothing; `js/router.js` reads the URL, decides
where scores live, resolves the set, loads its game, runs the round and shows
the results. The four games are dynamic imports behind `js/games/index.js` and
speak only to the `api` the round hands them.

## Data

- `localStorage['quiz:prefs:v1']`: `{ v: 1, lang, round, lastGame }`
- `localStorage['quiz:scores:v1']`: `{ v: 1, rounds: { "<game>/<setId>": ... } }`
- `localStorage['neokeys-prefs']`: the kit's own shortcut preferences
- `data/`: 27 files, `sets/index.json` plus 25 `neo-quiz-set/1` documents
  (482 items) and `data/README.md`

Both quiz keys go through the Persist kit, carry `v: 1`, are read defensively,
and a document with another `v` is ignored rather than migrated. Neither is
written while `state.store` is `"ephemeral"`.

## Conventions

- Zero build step. Plain ES modules loaded by `js/app.js`.
- Header and footer come from the shared kits. Do not add site-local
  `.neo-footer` or `.header-bar` CSS.
- No single JS file over ~500 lines. It currently holds.
- Every learner-facing string is an `{ en, es }` pair in `js/strings.js`,
  resolved with `api.t()`. `docs/DESIGN.md` section 12 is the table this file
  renders; a key missing there is missing here too.
- No em dashes and no en dashes, in code comments and JSON included. The CLI
  validator fails a set that carries one.
- Nothing a set document carries is ever parsed as markup: everything is built
  with `h()` from `js/utils.js`, and the format refuses a `<` followed by a
  letter anywhere.

## Gotchas

**There is one validator and two front ends, and the split matters in both
directions.** `js/validate-set.js` is the single implementation of the
`llms.txt` rules, imported by the engine (every built-in set and every `?set=`
document goes through it before it can reach the round or the scores) and by
`tools/validate-set.mjs`. The CLI adds the house checks a third-party document
is not held to: no em or en dash, no unknown field, and the index against the
files it names. Putting a contract rule in the CLI only means a fetched set
passes in the browser under a rule the project believes it enforces; putting a
house rule in `js/validate-set.js` means someone else's valid `neo-quiz-set/1`
document is refused for a rule `llms.txt` never stated. Decide which list a new
check belongs to before writing it.

**NeoKeys calls `preventDefault()` on every bound key before `run()`, which
would swallow Enter on a focused button or link.** That is why `onControl()` in
`js/keys.js` exists: an Enter with a `BUTTON`, `A`, `SELECT` or `INPUT` focused
clicks that control and returns, and only an Enter with nothing under it
continues the round. Space takes the same guard through the kit's unbound
verdict hook. Delete either check and Tab-to-Continue-then-Enter advances two
items at once, which reads as a dropped question rather than a double fire. The
kit also has no unregister, so a game's own keys (`order` binds Backspace) are
registered once per page with an empty `run` purely so the `?` sheet lists them;
the module keeps its own listener and removes it in `destroy()`.

**`round.items` is the shuffled round; `round.pool` is the whole set, and the
distinction is a real bug in `sound`.** `llms.txt` promises a module only
`{ items, index, lang, embed }`. The engine passes `pool` (every item of the
set) and `set` (the document) as well, a superset that is read and never
written. The row strip and the distractors draw from the pool because a
ten-item round of a seventy-kana set would otherwise build a kana row with holes
in it, and the four options would come from ten items. `poolOf()` falls back to
`round.items` so a bare host harness still works, which is exactly why the
failure is invisible: it only shows at small `limit`, and it shows as a thin,
slightly wrong row rather than an error.

**Where scores live is decided once, before anything is written and before
`quiz:ready` is posted.** `decideStore()` in `js/router.js` runs first on
purpose, so a host is told `store: "ephemeral"` up front instead of discovering
later that nothing was saved. Standalone persists when the browser lets it;
embedded needs the referrer on the allowlist *and* a working storage probe.
`isAllowedOrigin()` in `js/origin.js` is a label-boundary check, not a suffix
check: `evil-neorgon.com` and `neorgon.com.evil.io` are refused, as are an
origin carrying a path, query or credentials, the string `"null"` and a
non-string. `hostname.endsWith('neorgon.com')` fails several of those cases.
Nothing in root `make smoke` checks any of it and the negative case is awkward
to reach from a browser, so `tools/test-origin.mjs` is the whole enforcement.
The invariant, stated once: an unlisted origin can never cause a write to
quiz.neorgon.com's persistent storage.

**No referrer is not an allowed host, and it is quiet in both directions.** A
frame loaded with `referrerpolicy="no-referrer"`, or a browser that strips the
referrer, gets `store: "ephemeral"` and the engine posts nothing at all:
outbound messages go to the referrer's origin, never `'*'`. The game still plays
perfectly, so a host that has stopped receiving `quiz:answer` looks fine and
just records nothing. That is the failure the whole contract is written against;
check the referrer policy before checking anything else, and treat silence after
`quiz:ready` as a fault rather than an idle learner. The localhost clause is
gated on the engine itself being local, so it is dead code in production and
exists only so Runcible on 8878 can embed Quiz on 8880 for real.

**Every file under `data/sets/` is generated. Never hand edit one.** They are
emitted by `projects/runcible-site/tools/build-sets.mjs`, which writes each set
twice (here for the library, and to `runcible-site/books/japanese/sets/` for the
chapter that embeds it) and refuses to finish if the two copies differ. The one
file a person edits is `runcible-site/tools/selection/sets.json`. A hand edit
here survives until the next run, and a hand edit that lands in one copy and not
the other is the drift the generator exists to prevent. Item ids are derived
from the corpus id of the record and never from its position, so a re-run over
the same corpus emits the same ids: an id that moves orphans every attempt a
learner made on that item, and nothing would report it. Same rule for `id` at
the set level, since `quiz:scores:v1` is keyed by it.

**The `skill` a host records is the exercise spec's, not the engine's.**
`quiz:answer` carries the set's own `skill` (or `?skill=`, or `quiz.<game>`),
and that string is set-internal so a set stays reusable across Books. Runcible
records each answer as one attempt under the *spec's* `skill` with source
`"quiz"`, and `runcible-site/tools/validate-book.mjs` refuses a skill nothing in
the Book reads. The same validator refuses a quiz `src` that is not declared in
the Book's `data[]`, the same rule as a deck. Rappel shipped the other way round
once and every deck review counted for zero with no error anywhere.

**A wrong answer without a `why` is a defect the engine logs, and games never
advance themselves.** A module calls `api.answer()` then `api.next()`; the round
shows the panel for every wrong answer since the mount and advances on Continue,
or after 600ms when there were none. A module that calls `next()` early, or
renders its own Continue, breaks the focus contract (`js/round.js` moves focus
to the panel title, then to the new item's first option).

**A digit never appears in an option's text.** The keycap is a separate box
beside the button, `aria-hidden`, with `data-key` and `aria-keyshortcuts` on the
button itself; `1.` or `3)` inside an option's label is the exact defect this
site was built to fix. The one exception is `beats`, where the options are
numerals and the numeral *is* the key, which is also why the beat window never
climbs past 9: the engine binds digits 1 to 9 only.

## Do not touch

- `js/neorgon-*.js` and `css/neorgon-*.css`: vendored kits, regenerated by
  `packages/neorgon-ui/sync-*.sh`.
- `js/neokeys/`: the NeoKeys kit, vendored from `packages/neorgon-ui/keys/`.
- `data/sets/*.json`: generated by `runcible-site/tools/build-sets.mjs`.
- The EDRDG attribution sentence inside a set's `licence.attribution`: it is
  quoted in the licensor's own wording, not written here.
