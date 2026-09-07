/**
 * The four game ids, each a dynamic import of js/games/<id>.js.
 *
 * The game files are written separately from the engine. A game that is
 * listed here but missing on disk fails at run time with a named error
 * (the id and the path), never a blank surface: that case is the engine's
 * to show, and loadGame() is where it is told apart from an unknown id.
 */

export const GAMES = {
  beats: () => import('./beats.js'),
  sound: () => import('./sound.js'),
  pairs: () => import('./pairs.js'),
  order: () => import('./order.js'),
};

export const GAME_IDS = Object.keys(GAMES);

export class GameLoadError extends Error {
  constructor(code, id, detail) {
    super(detail || code);
    this.code = code;    // 'game-unknown' | 'game-missing'
    this.game = id;
    this.path = `js/games/${id}.js`;
  }
}

/**
 * Resolve a game module's default export, checked against the interface
 * llms.txt pins: id, name, describe, keys, mount.
 */
export async function loadGame(id) {
  const loader = GAMES[id];
  if (!loader) throw new GameLoadError('game-unknown', id, `no game called "${id}"`);
  let mod;
  try {
    mod = await loader();
  } catch (err) {
    throw new GameLoadError('game-missing', id, err && err.message ? err.message : String(err));
  }
  const game = mod && mod.default;
  if (!game || typeof game.mount !== 'function') {
    throw new GameLoadError('game-missing', id, 'the module has no default export with mount()');
  }
  if (game.id !== id) console.warn(`[quiz] js/games/${id}.js exports id "${game.id}"`);
  return { ...game, id, keys: Array.isArray(game.keys) ? game.keys : [] };
}
