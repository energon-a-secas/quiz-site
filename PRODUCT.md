# Quiz: product one-pager

**What it is:** Small games that teach one thing at a time: count the beats of a
loanword, pick the sound of a kana, match two columns, put a song line back in
order. A round is 5, 10 or 20 items, and every wrong answer is explained with a
picture before a sentence (the beat tiles, the kana row, the marked line). The
small-stuff complement to Proctor: not an exam.

**Who it is for:** A beginner in Japanese who already has a lesson (Runcible, a
textbook, a class) and wants five minutes of drill on the one thing that lesson
just taught, without the weight of a test. Runcible embeds the games as
exercises and takes the answers as evidence over `neo-quiz-embed/1`.

**Register:** product (a tool someone uses), not brand (a page someone visits).
The tool disappears into the round.

**The scene:** A learner on a phone, on a train, in the evening, one thumb free,
about forty seconds between stops; or a lesson page in Runcible on a laptop with
the game in a frame under the reading. The default is the fleet's dark base
tokens because the host pages are; the surface is one column with no card, so
the frame and the page read as one.

**What done looks like:** A round finished in under three minutes, the results
screen showing which items to look at again and why, and the score saved on the
device (or posted to the host) without the learner doing anything.

**Anchor references:** A metronome, beats lighting in time. A kana chart, one row
of it lit. Fridge magnets, for the order chips.

**Anti-references:** Duolingo's streak pressure and confetti; a numbered
`1. 2. 3.` list as options (the owner's complaint that started the site); a
matching game whose answer is printed on the visible card; a "wrong" screen that
says only "Correct answer: 3". No timer bar, no percent grade, no exam register,
no mascot, no gradient text, no card inside a card.

**Strategic principles:**
- Every wrong answer gets a why, and the why is a picture first: equal-width
  beat tiles, the lit kana row, the marked song line. A wrong answer with no why
  is a defect the engine logs.
- One accent colour (`#fb923c`) doing state work: the current pick, the right
  answer, focus, the streak, filled progress. Danger only as a stroke, never a
  filled box, so after a miss the loudest thing on screen is the right answer.
  No green.
- Motion reports a state change and then stops. Nothing bounces, nothing
  choreographs a page load, and reduced motion turns every entry into a 100ms
  opacity change.
- Time is recorded and reported, never raced. There is no countdown.
- Nothing in the prompt gives the answer away: no romaji before the count, no
  reading on the pairs board, no gloss before the order commits, and never a
  digit inside an option's own text.
- Every learner-facing string is an `{en, es}` pair; a Spanish reader shown
  English is told once per screen, in one line.
- Where a score is written is stated up front, not discovered later: an embed
  that cannot persist says so on the round, and the "Open in Quiz" link is the
  path that always saves.
