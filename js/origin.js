/**
 * The embed origin allowlist. llms.txt, "The origin allowlist, and the one
 * invariant". Copied from projects/rappel-site/js/origin.js with the names
 * changed, and nothing else: the label-boundary check is the whole point.
 *
 * Pure functions, no DOM, no globals. That is deliberate: nothing in root
 * `make smoke` checks this rule and QA cannot easily exercise the negative
 * case in a browser, so the only thing standing between an unlisted origin and
 * a write to quiz.neorgon.com is tools/test-origin.mjs.
 *
 * The invariant, stated once: an unlisted origin can never cause a write to
 * quiz.neorgon.com's persistent storage.
 *
 * The classic bug this file exists to avoid is suffix matching. "neorgon.com"
 * is a suffix of "evil-neorgon.com", so the check is on the LABEL boundary:
 * either the host is exactly neorgon.com, or it ends with ".neorgon.com".
 */

const APEX = 'neorgon.com';
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

/** Parse an origin string into a URL, or null. Never throws. */
function parseOrigin(value) {
  if (typeof value !== 'string' || !value || value === 'null') return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  // An origin carries no path, query or fragment. Anything longer is not one.
  if (url.pathname !== '/' || url.search || url.hash) return null;
  if (url.username || url.password) return null;
  return url;
}

/** true when the host is neorgon.com itself or a subdomain of it. */
export function isNeorgonHost(hostname) {
  return hostname === APEX || hostname.endsWith(`.${APEX}`);
}

/** true when this is a local development origin over plain http. */
export function isLocalOrigin(value) {
  const url = parseOrigin(value);
  if (!url) return false;
  return url.protocol === 'http:' && LOCAL_HOSTS.includes(url.hostname);
}

/**
 * The allowlist.
 *
 * @param {string} origin      the referrer's origin, or an inbound event.origin
 * @param {string} selfOrigin  the engine's own location.origin
 * @returns {boolean}
 */
export function isAllowedOrigin(origin, selfOrigin) {
  const url = parseOrigin(origin);
  if (!url) return false;

  if (url.protocol === 'https:' && isNeorgonHost(url.hostname)) return true;

  // The localhost clause exists so http://localhost:8878 (Runcible) can embed
  // http://localhost:8880 (Quiz) for real. It is gated on the ENGINE itself
  // being local, so it is dead code in production.
  if (isLocalOrigin(selfOrigin) && isLocalOrigin(origin)) return true;

  return false;
}

/**
 * Whether ?set= names a URL that may be fetched: https, or plain http on
 * localhost while the engine itself is on localhost. A bare id (no scheme) is
 * not a URL at all and returns false; the caller treats it as a built-in id.
 *
 * @param {string} src         the raw ?set= value
 * @param {string} selfOrigin  the engine's own location.origin
 */
export function isAllowedSetSrc(src, selfOrigin) {
  if (typeof src !== 'string' || !src) return false;
  let url;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') return true;
  return isLocalOrigin(selfOrigin) && isLocalOrigin(url.origin);
}

/**
 * The set id a document is scored under. llms.txt, "Where a fetched set is
 * stored": a set fetched from an origin other than neorgon.com or one of its
 * subdomains is namespaced, so a third-party document claiming a built-in id
 * cannot merge into it.
 *
 * @param {string} setId     the set document's own id
 * @param {string|null} src  where it came from, or null for built-in
 * @param {string} hash      first 12 hex of SHA-256 of src, from sha256Hex()
 */
export function namespacedSetId(setId, src, hash) {
  if (!src) return setId;
  let url;
  try {
    url = new URL(src);
  } catch {
    return setId;
  }
  if (isNeorgonHost(url.hostname)) return setId;
  if (isLocalOrigin(url.origin)) return setId;
  return `ext:${hash}:${setId}`;
}

/** First 12 hex characters of the SHA-256 of a string. */
export async function sha256Hex(text, len = 12) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, len);
}
