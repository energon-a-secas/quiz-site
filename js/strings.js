/**
 * Every learner-facing string, as an { en, es } pair. DESIGN.md section 12 is
 * the table this file renders; a key missing there is missing here too. Host
 * facing text (quiz:error messages, console lines) is English and lives where
 * it is emitted.
 *
 * Placeholders are {name}. Resolve with str(key, lang, vars) or, for a value
 * carried by a set document, with t(value, lang, vars).
 */

export const STRINGS = {
  'game.beats.name': { en: 'Beats', es: 'Pulsos' },
  'game.beats.describe': { en: 'How many beats does this word have?', es: '¿Cuántos pulsos tiene esta palabra?' },
  'game.sound.name': { en: 'Sound', es: 'Sonido' },
  'game.sound.describe': { en: 'Which sound is this kana? Or which kana makes this sound?', es: '¿Qué sonido tiene este kana? ¿O qué kana hace este sonido?' },
  'sound.toSound': { en: 'What is the sound?', es: '¿Cuál es el sonido?' },
  'sound.toKana': { en: 'Which kana?', es: '¿Qué kana?' },
  'game.pairs.name': { en: 'Pairs', es: 'Parejas' },
  'game.pairs.describe': { en: 'Match each word with its meaning.', es: 'Une cada palabra con su significado.' },
  'pairs.prompt': { en: 'Match the pairs', es: 'Une las parejas' },
  'pairs.reading': { en: 'Reading', es: 'Lectura' },
  'game.order.name': { en: 'Order', es: 'Orden' },
  'game.order.describe': { en: 'Put the song line back in order.', es: 'Vuelve a ordenar el verso de la canción.' },
  'order.undo': { en: 'Undo last piece', es: 'Deshacer la última pieza' },
  'order.line': { en: 'Your line', es: 'Tu verso' },
  'order.bank': { en: 'Pieces', es: 'Piezas' },
  'order.gloss': { en: 'Meaning', es: 'Significado' },
  'feedback.wrong': { en: 'Not quite', es: 'No exactamente' },
  'feedback.answerWas': { en: 'The answer was', es: 'La respuesta era' },
  'feedback.continue': { en: 'Continue', es: 'Continuar' },
  'feedback.beats': { en: '{kana} has {n} beats: {split}', es: '{kana} tiene {n} pulsos: {split}' },
  'feedback.sound': { en: '{kana} is in the {row} row, {column} column: {sound}', es: '{kana} está en la fila {row}, columna {column}: {sound}' },
  'feedback.soundAlone': { en: '{kana} is the {row} row on its own: {sound}', es: '{kana} es la fila {row} por sí sola: {sound}' },
  'feedback.pairs': { en: '{left} goes with {right}', es: '{left} va con {right}' },
  'feedback.order': { en: '{token} goes here, not {chosen}', es: '{token} va aquí, no {chosen}' },
  progress: { en: '{n} of {total}', es: '{n} de {total}' },
  'streak.count': { en: '{n} in a row', es: '{n} seguidas' },
  // A filtered round names its filter in words beside the game name, and in
  // the embed bar. row.<label> is the one place a row label becomes prose;
  // every row without an entry prints as the set writes it (k, ky, fu).
  'filter.row': { en: 'the {row} row', es: 'la fila {row}' },
  'filter.rows': { en: 'the {list} rows', es: 'las filas {list}' },
  'filter.and': { en: 'and', es: 'y' },
  'filter.other': { en: '{field}: {list}', es: '{field}: {list}' },
  'row.vowels': { en: 'vowel', es: 'de las vocales' },
  'row.moraic-n': { en: 'ん', es: 'ん' },
  'results.title': { en: 'Round over', es: 'Ronda terminada' },
  'results.perfect': { en: 'Perfect round', es: 'Ronda perfecta' },
  'results.partial': { en: 'Round left at {n} of {total}', es: 'Ronda interrumpida en {n} de {total}' },
  'results.score': { en: '{correct} of {total} right', es: '{correct} de {total} correctas' },
  'results.median': { en: 'Median {s} s per answer', es: 'Mediana de {s} s por respuesta' },
  'results.streak': { en: 'Best streak {n}', es: 'Mejor racha: {n}' },
  'results.misses': { en: 'Worth another look', es: 'Para repasar' },
  'results.again': { en: 'Play again', es: 'Jugar otra vez' },
  'results.change': { en: 'Change game', es: 'Cambiar de juego' },
  'library.title': { en: 'Pick a game', es: 'Elige un juego' },
  'library.set': { en: 'Set', es: 'Conjunto' },
  'library.items': { en: '{n} items', es: '{n} elementos' },
  'library.round': { en: 'Round of {n}', es: 'Ronda de {n}' },
  'library.play': { en: 'Play', es: 'Jugar' },
  'library.last': { en: 'Last {correct}/{total}', es: 'Última: {correct}/{total}' },
  'library.unplayed': { en: 'Not played yet', es: 'Aún sin jugar' },
  'library.noSets': { en: 'No set for this game yet.', es: 'Todavía no hay ningún conjunto para este juego.' },
  'library.roundLabel': { en: 'Round length', es: 'Longitud de la ronda' },
  'embed.open': { en: 'Open in Quiz', es: 'Abrir en Quiz' },
  'embed.notSaved': { en: 'Scores are not saved in this frame.', es: 'Los resultados no se guardan en este marco.' },
  'quit.title': { en: 'Leave this round?', es: '¿Salir de esta ronda?' },
  'quit.leave': { en: 'Leave', es: 'Salir' },
  'quit.stay': { en: 'Keep playing', es: 'Seguir jugando' },
  'live.progress': { en: 'Item {n} of {total}', es: 'Elemento {n} de {total}' },
  'live.correct': { en: 'Right. {n} of {total}.', es: 'Correcto. {n} de {total}.' },
  'live.wrong': { en: 'Not quite. The answer was {expected}.', es: 'No exactamente. La respuesta era {expected}.' },
  'live.loading': { en: 'Loading the set', es: 'Cargando el conjunto' },
  'keycap.sr': { en: 'Press {key}', es: 'Pulsa {key}' },
  'keys.pick': { en: 'Pick an option', es: 'Elegir una opción' },
  'keys.pickHint': { en: '1 to 9, the keycap beside the option, or the numeral itself in Beats', es: '1 a 9, la tecla junto a la opción, o el propio número en Pulsos' },
  'keys.continue': { en: 'Continue after feedback', es: 'Continuar tras la explicación' },
  'keys.continueHint': { en: 'Enter or Space', es: 'Enter o la barra espaciadora' },
  'keys.restart': { en: 'Restart the round', es: 'Reiniciar la ronda' },
  'keys.escape': { en: 'Esc asks before leaving a round', es: 'Esc pregunta antes de salir de la ronda' },
  'keys.group': { en: 'The round', es: 'La ronda' },
  'attrib.source': { en: 'Source', es: 'Fuente' },
  'attrib.more': { en: 'Licence and attribution', es: 'Licencia y atribución' },
  'lang.fallback': { en: 'Parts of this set have no Spanish yet and are shown in English.', es: 'Partes de este conjunto aún no tienen traducción y se muestran en inglés.' },
  'error.title': { en: 'Nothing to play', es: 'Nada que jugar' },
  'error.noSet': { en: 'No set was given. Pick one from the library.', es: 'No se indicó ningún conjunto. Elige uno en la biblioteca.' },
  'error.fetch': { en: 'The set could not be fetched.', es: 'No se pudo descargar el conjunto.' },
  'error.invalid': { en: 'This is not a valid neo-quiz-set/1 document: {reason}', es: 'No es un documento neo-quiz-set/1 válido: {reason}' },
  'error.game': { en: 'There is no game called {game}.', es: 'No existe un juego llamado {game}.' },
  'error.mismatch': { en: 'This set is for {setGame}, not {game}.', es: 'Este conjunto es para {setGame}, no para {game}.' },
  'error.filter': { en: 'Nothing in this set matches {filter}. Check the field and its values.', es: 'Nada en este conjunto coincide con {filter}. Revisa el campo y sus valores.' },
  'error.module': { en: '{path} did not load: {reason}', es: '{path} no se cargó: {reason}' },
  'error.library': { en: 'Back to the library', es: 'Volver a la biblioteca' },
  'error.boot': { en: 'Quiz could not start. Reload the page; the browser console names what blocked it. Nothing was written.', es: 'Quiz no pudo iniciarse. Recarga la página; la consola del navegador indica qué lo bloqueó. No se escribió nada.' },
  'header.subtitle': { en: 'Four small games for kana, beats and song lines', es: 'Cuatro juegos pequeños de kana, pulsos y versos' },
  footer: { en: 'Runs entirely in your browser. Scores stay on this device.', es: 'Funciona por completo en tu navegador. Los resultados se quedan en este dispositivo.' },
};

const warned = new Set();

/* The honesty rule (CONTRACTS convention 2): a page shown in Spanish with
   untranslated content says so once, rather than half translating. Every t()
   records whether it fell back to English; the router resets the flag before
   a screen paints and shows one line when it is set. A game mounts after that
   paint, so a watcher reveals the line the first time a later t() falls back. */
let fellBack = false;
const watchers = new Set();

/** Called before a screen is built. */
export function beginPage() { fellBack = false; }

/** True when anything on this screen was shown in English to a Spanish reader. */
export function hadFallback() { return fellBack; }

/** Be told the first time this screen falls back. Returns the unsubscribe. */
export function onFallback(fn) { watchers.add(fn); return () => watchers.delete(fn); }

function noteFallback() {
  if (fellBack) return;
  fellBack = true;
  for (const fn of watchers) {
    try { fn(); } catch (e) { console.error('[quiz]', e); }
  }
}

/**
 * Resolve a bilingual value: a bare string is English, an object is read by
 * lang with English as the fallback, then Spanish, then empty. Never undefined
 * reaching the DOM.
 */
export function t(value, lang = 'en', vars) {
  let text = '';
  if (typeof value === 'string') text = value;
  else if (value && typeof value === 'object') {
    text = value[lang] || value.en || value.es || '';
    if (lang !== 'en' && !value[lang] && text) noteFallback();
  }
  return vars ? fill(text, vars) : text;
}

/** Substitute {name} placeholders. Values are not escaped; the DOM builder does that. */
export function fill(text, vars = {}) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/**
 * A row label as words. DESIGN.md 3.3: wherever {row} prints, a label with a
 * row.<label> entry is replaced (vowels, moraic-n) and every other row prints
 * as the set writes it (k, ky, fu). One implementation, read by the round
 * header (through js/sets.js) and by the sound game's why line, so the two
 * cannot drift.
 */
export function rowWord(row, lang = 'en') {
  const key = `row.${row}`;
  return key in STRINGS ? t(STRINGS[key], lang) : String(row ?? '');
}

/** A string from the table, by key. An unknown key returns the key and warns once. */
export function str(key, lang = 'en', vars) {
  const entry = STRINGS[key];
  if (!entry) {
    if (!warned.has(key)) { warned.add(key); console.warn(`[quiz] no string for "${key}"`); }
    return key;
  }
  return t(entry, lang, vars);
}
