/**
 * Embed mode and the postMessage bridge. Contract neo-quiz-embed/1, llms.txt.
 * Shaped after projects/rappel-site/js/embed.js, the fleet's one precedent.
 *
 * Three rules, each a class of bug:
 *
 *   1. Every message carries v: 1, in both directions, and a message whose v
 *      this engine does not know is dropped. The two sites deploy separately,
 *      so a host published against version 1 has to keep working.
 *   2. Outbound posts go to the referrer's origin, never '*'. With no referrer
 *      the engine posts nothing at all.
 *   3. quiz:hello makes the engine re-emit quiz:ready. The engine can be
 *      ready before the host attaches its listener.
 *
 * The silent failure this is written against: a host that stops receiving
 * quiz:answer shows a working game and quietly stops recording evidence.
 */

import { state } from './state.js';
import { str, t } from './strings.js';
import { h } from './utils.js';

export const PROTOCOL_VERSION = 1;
export const CONTRACT = 'neo-quiz-embed/1';

let hostOrigin = null;

/** Everything the URL says. llms.txt, "URL parameters". */
export function readConfig(search = location.search) {
  const p = new URLSearchParams(search);
  const rawLimit = p.get('limit');
  // Not a finite positive integer: discarded, never rounded.
  const limit = rawLimit && /^\d+$/.test(rawLimit) && Number(rawLimit) > 0 ? Number(rawLimit) : null;
  const seed = (p.get('seed') || '').trim().slice(0, 64) || null;
  const skill = p.get('skill');
  const lang = p.get('lang');
  return {
    embed: p.get('embed') === '1',
    game: (p.get('game') || '').trim() || null,
    set: (p.get('set') || '').trim() || null,
    limit,
    seed,
    // null when absent, so a saved preference is not overwritten with English.
    lang: lang === 'en' || lang === 'es' ? lang : null,
    skill: skill && /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(skill) ? skill : null,
    theme: p.get('theme'),
  };
}

/** The origin the engine talks to. Empty when there is no referrer to trust. */
export function resolveHostOrigin() {
  if (hostOrigin !== null) return hostOrigin;
  try {
    hostOrigin = document.referrer ? new URL(document.referrer).origin : '';
  } catch {
    hostOrigin = '';
  }
  state.hostOrigin = hostOrigin || null;
  return hostOrigin;
}

/** Post one message to the host. Never '*', never without a version. */
export function post(type, payload = {}) {
  if (!state.embed) return false;
  const target = resolveHostOrigin();
  if (!target || window.parent === window) return false;
  try {
    window.parent.postMessage({ v: PROTOCOL_VERSION, type, ...payload }, target);
    return true;
  } catch {
    return false;
  }
}

/** quiz:ready. Once the set resolved, and again on every quiz:hello. */
export function emitReady() {
  if (!state.set) return false;
  return post('quiz:ready', {
    setId: state.setId,
    setVersion: state.set.version,
    game: state.gameId,
    name: t(state.set.name, state.lang),
    total: state.limit,
    store: state.store,
  });
}

/** quiz:error. The frame shows its own message either way. */
export function emitError(code, message) {
  return post('quiz:error', { code, message });
}

/** quiz:resize, debounced 120ms, so a host that fixed no height gets no scrollbar. */
let resizeTimer = null;
export function emitResize() {
  if (!state.embed) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    post('quiz:resize', { height: Math.ceil(document.documentElement.scrollHeight) });
  }, 120);
}

/**
 * The inbound half. hello, start and theme are accepted from any origin: they
 * are read-only or round-scoped, and nothing a host can send writes storage.
 */
function onMessage(event) {
  const m = event.data;
  if (!m || typeof m !== 'object') return;
  if (m.v !== PROTOCOL_VERSION) return;
  if (typeof m.type !== 'string' || !m.type.startsWith('quiz:')) return;

  switch (m.type) {
    case 'quiz:hello':
      emitReady();
      break;
    case 'quiz:start':
      document.dispatchEvent(new CustomEvent('quiz:host-start', {
        detail: { limit: m.limit, seed: m.seed },
      }));
      break;
    case 'quiz:theme':
      if (typeof m.theme === 'string' && /^[\w-]{1,32}$/.test(m.theme)) {
        document.documentElement.dataset.theme = m.theme;
      }
      break;
    default:
      break;
  }
}

/** The same URL without embed and skill: the path that always persists. */
export function openHref() {
  const p = new URLSearchParams(location.search);
  p.delete('embed');
  p.delete('skill');
  const qs = p.toString();
  return `${location.origin}${location.pathname}${qs ? `?${qs}` : ''}`;
}

/**
 * Strip the chrome to a slim bar: the set name left, "Open in Quiz" right.
 * body.is-embed hides the header kit, footer kit, beacon and skip link in CSS.
 */
export function mountEmbedBar() {
  document.body.classList.add('is-embed');
  const bar = h('div', { class: 'q-embed-bar' }, [
    h('span', { id: 'embedBarTitle', text: 'Quiz' }),
    h('a', {
      href: openHref(), target: '_blank', rel: 'noopener noreferrer', text: str('embed.open', state.lang),
    }),
  ]);
  document.body.prepend(bar);
  if (state.store !== 'engine') {
    bar.after(h('p', { class: 'q-embed-note', text: str('embed.notSaved', state.lang) }));
  }
  return bar;
}

/** Put the set name in the bar once a set has loaded. */
export function setEmbedTitle(text) {
  const el = document.getElementById('embedBarTitle');
  if (el) el.textContent = text;
}

/** Install the inbound listener and the resize observer. */
export function startBridge() {
  window.addEventListener('message', onMessage);
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(emitResize).observe(document.documentElement);
  }
}
