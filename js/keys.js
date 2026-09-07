/**
 * Keyboard shortcuts, through the NeoKeys kit rather than a private listener.
 *
 * The kit brings the ? sheet, one document listener, the typing guard and the
 * WCAG 2.1.4 disable switch and remap panel. Everything here dispatches a
 * quiz:key event on document; the round (js/round.js) and the router act on
 * it, so this file never reaches into their state.
 *
 * The sheet lists the digits once (DESIGN.md 3.1): key 1 is registered with
 * the label "1 to 9", and 2 to 9, Space and Esc are handled from the kit's
 * onKey verdict hook, which runs after the same typing guard, modifier check,
 * IME check and disable switch as a registered entry. ? h and g are the
 * kit's; H is off inside an iframe, where there is no chrome to hide.
 */

import { init } from './neokeys/index.js';
import { state } from './state.js';
import { str } from './strings.js';

const registeredGameKeys = new Set();
const GAME_KEY_LABELS = { backspace: 'order.undo' };

function dispatch(action, extra = {}) {
  document.dispatchEvent(new CustomEvent('quiz:key', { detail: { action, ...extra } }));
}

/** Enter and Space on a focused control are that control's own activation. */
function onControl() {
  const a = document.activeElement;
  return !!a && (a.tagName === 'BUTTON' || a.tagName === 'A' || a.tagName === 'SELECT' || a.tagName === 'INPUT');
}

function onVerdict(v, e) {
  if (v.fired || v.reason !== 'unbound') return;
  if (document.querySelector('dialog[open]')) return;
  const k = v.key;
  if (/^[1-9]$/.test(k)) {
    e.preventDefault();
    dispatch('pick', { n: Number(k) });
  } else if (k === ' ') {
    if (onControl()) return;
    e.preventDefault();
    dispatch('continue');
  } else if (k === 'escape') {
    dispatch('escape');
  }
}

export function initKeys() {
  const L = (k) => str(k, state.lang);
  const group = L('keys.group');
  const keys = init({ chromeToggle: state.embed ? false : undefined, onKey: onVerdict });
  keys.register([
    {
      key: '1', id: 'quiz:pick', label: L('keys.pick'), hint: L('keys.pickHint'), group,
      run: () => dispatch('pick', { n: 1 }),
    },
    {
      // The kit calls preventDefault() on every bound key before run(), which
      // would swallow Enter on a focused button or link. So a control that has
      // focus gets the activation the browser was about to give it, and only
      // an Enter with nothing under it continues the round.
      key: 'enter', id: 'quiz:continue', label: L('keys.continue'), hint: L('keys.continueHint'), group,
      run: () => { if (onControl()) { document.activeElement.click(); return; } dispatch('continue'); },
    },
    {
      key: 'r', id: 'quiz:restart', label: L('keys.restart'), hint: L('keys.escape'), group,
      run: () => dispatch('restart'),
    },
  ]);
  return keys;
}

/**
 * List a game's own keys (llms.txt: keys beyond the digits) in the sheet.
 * The kit has no unregister, so each key is registered once per page and the
 * module keeps its own listener; the entry's run is empty on purpose. A
 * reserved key is refused here before the kit refuses it again.
 */
export function registerGameKeys(game) {
  if (!window.NeoKeys || !game || !Array.isArray(game.keys)) return;
  const group = str('keys.group', state.lang);
  game.keys.forEach((key) => {
    const k = String(key).toLowerCase();
    if (!k || registeredGameKeys.has(k)) return;
    if (k in window.NeoKeys.RESERVED) {
      console.warn(`[quiz] ${game.id} asked for "${key}", which is fleet-reserved`);
      return;
    }
    registeredGameKeys.add(k);
    const labelKey = GAME_KEY_LABELS[k];
    window.NeoKeys.register([{
      key: k,
      id: `game:${game.id}:${k}`,
      label: labelKey ? str(labelKey, state.lang) : `${str(`game.${game.id}.name`, state.lang)}: ${key}`,
      group,
      run: () => {},
    }]);
  });
}
