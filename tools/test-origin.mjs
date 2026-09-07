#!/usr/bin/env node
/**
 * Origin allowlist checks. llms.txt asks for exactly this file and says it
 * must cover at least Rappel's cases, so these are Rappel's cases with the
 * engine's port changed, plus the ?set= rule and the ext: namespacing.
 *
 *   node tools/test-origin.mjs      # from inside projects/quiz-site
 *
 * Nothing in root `make smoke` checks the allowlist and the negative case is
 * awkward to reach from a browser, so these assertions are the enforcement.
 */

import { isAllowedOrigin, isAllowedSetSrc, isLocalOrigin, isNeorgonHost, namespacedSetId }
  from '../js/origin.js';

const ENGINE_PROD = 'https://quiz.neorgon.com';
const ENGINE_LOCAL = 'http://localhost:8880';

let pass = 0;
const fails = [];

function check(label, got, want) {
  const ok = got === want;
  if (ok) { pass += 1; console.log(`  ok   ${label}  -> ${got}`); }
  else { fails.push(label); console.log(`  FAIL ${label}  -> ${got}, want ${want}`); }
}
const allow = (o, self, label) => check(label, isAllowedOrigin(o, self), true);
const refuse = (o, self, label) => check(label, isAllowedOrigin(o, self), false);

console.log('\nAllowed, engine in production');
allow('https://runcible.neorgon.com', ENGINE_PROD, 'https://runcible.neorgon.com');
allow('https://neorgon.com', ENGINE_PROD, 'https://neorgon.com');
allow('https://quiz.neorgon.com', ENGINE_PROD, 'the engine embedding itself');
allow('https://rappel.neorgon.com', ENGINE_PROD, 'any other fleet subdomain');
allow('https://a.b.neorgon.com', ENGINE_PROD, 'a deeper subdomain');

console.log('\nRefused, engine in production');
refuse('https://evil-neorgon.com', ENGINE_PROD, 'https://evil-neorgon.com (the suffix bug)');
refuse('https://neorgon.com.evil.io', ENGINE_PROD, 'https://neorgon.com.evil.io');
refuse('https://xneorgon.com', ENGINE_PROD, 'a host that merely contains the name');
refuse('https://neorgon.com.', ENGINE_PROD, 'a trailing dot host');
refuse('http://neorgon.com', ENGINE_PROD, 'the apex over plain http');
refuse('http://runcible.neorgon.com', ENGINE_PROD, 'a subdomain over plain http');
refuse('https://runcible.neorgon.com.attacker.test', ENGINE_PROD, 'the name as a left label');
refuse('https://neorgonxcom', ENGINE_PROD, 'the dot replaced');
refuse('http://localhost:8878', ENGINE_PROD, 'localhost when the engine is NOT local');
refuse('http://127.0.0.1:8878', ENGINE_PROD, '127.0.0.1 when the engine is NOT local');
refuse('null', ENGINE_PROD, 'a sandboxed frame posting origin "null"');
refuse('', ENGINE_PROD, 'an empty origin');
refuse('https://', ENGINE_PROD, 'a bare scheme');
refuse('not a url', ENGINE_PROD, 'a string that is not a URL');
refuse('https://user:pw@neorgon.com', ENGINE_PROD, 'credentials in the origin');
refuse('https://neorgon.com/evil', ENGINE_PROD, 'a path, which an origin never has');
refuse('https://neorgon.com?x=1', ENGINE_PROD, 'a query, which an origin never has');
refuse('file://', ENGINE_PROD, 'a file URL');
refuse('data:text/html,x', ENGINE_PROD, 'a data URL');
refuse('javascript:alert(1)', ENGINE_PROD, 'a javascript URL');
refuse(undefined, ENGINE_PROD, 'undefined');
refuse(null, ENGINE_PROD, 'null');
refuse({ toString: () => 'https://neorgon.com' }, ENGINE_PROD, 'an object pretending to be a string');

console.log('\nThe localhost clause, engine on localhost');
allow('http://localhost:8878', ENGINE_LOCAL, 'http://localhost:8878 when the engine IS local');
allow('http://127.0.0.1:8878', ENGINE_LOCAL, '127.0.0.1 when the engine is local');
allow('https://neorgon.com', ENGINE_LOCAL, 'the apex is still allowed while local');
refuse('https://evil-neorgon.com', ENGINE_LOCAL, 'the suffix bug is still refused while local');
refuse('http://192.168.1.10:8878', ENGINE_LOCAL, 'a LAN address is not localhost');
refuse('http://localhost.evil.io', ENGINE_LOCAL, 'a host that starts with localhost');
refuse('https://localhost:8878', ENGINE_LOCAL, 'https localhost, since the clause is http only');

console.log('\nHelpers');
check('isNeorgonHost(neorgon.com)', isNeorgonHost('neorgon.com'), true);
check('isNeorgonHost(a.neorgon.com)', isNeorgonHost('a.neorgon.com'), true);
check('isNeorgonHost(evil-neorgon.com)', isNeorgonHost('evil-neorgon.com'), false);
check('isLocalOrigin(http://localhost:1)', isLocalOrigin('http://localhost:1'), true);
check('isLocalOrigin(https://localhost:1)', isLocalOrigin('https://localhost:1'), false);

console.log('\n?set= fetch rule');
check('https set src, engine in production', isAllowedSetSrc('https://runcible.neorgon.com/s.json', ENGINE_PROD), true);
check('https set src from anywhere', isAllowedSetSrc('https://example.test/s.json', ENGINE_PROD), true);
check('http set src, engine in production', isAllowedSetSrc('http://example.test/s.json', ENGINE_PROD), false);
check('localhost set src, engine in production', isAllowedSetSrc('http://localhost:8878/s.json', ENGINE_PROD), false);
check('localhost set src, engine on localhost', isAllowedSetSrc('http://localhost:8878/s.json', ENGINE_LOCAL), true);
check('a bare id is not a URL', isAllowedSetSrc('jp-loanwords-beats', ENGINE_LOCAL), false);
check('a relative path is not a URL', isAllowedSetSrc('data/sets/x.json', ENGINE_LOCAL), false);
check('a javascript URL', isAllowedSetSrc('javascript:alert(1)', ENGINE_LOCAL), false);

console.log('\nSet id namespacing (the ext: rule)');
check('built-in keeps its id', namespacedSetId('jp-kana', null, 'abc'), 'jp-kana');
check('a neorgon.com src keeps its id', namespacedSetId('jp-kana', 'https://runcible.neorgon.com/s.json', 'abc'), 'jp-kana');
check('a localhost src keeps its id', namespacedSetId('jp-kana', 'http://localhost:8878/s.json', 'abc'), 'jp-kana');
check('a third-party src is namespaced', namespacedSetId('jp-kana', 'https://example.test/s.json', 'abc123def456'), 'ext:abc123def456:jp-kana');
check('the suffix bug does not win a plain id', namespacedSetId('jp-kana', 'https://evil-neorgon.com/s.json', 'deadbeef0000'), 'ext:deadbeef0000:jp-kana');

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  failed: ${f}`));
  process.exit(1);
}
