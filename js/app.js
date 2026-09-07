// Entry point. It wires and nothing else: every decision is in js/router.js.

import { boot } from './router.js';
import { str } from './strings.js';

boot().catch((err) => {
  console.error('Quiz failed to start', err);
  const root = document.getElementById('quiz-root');
  if (root) {
    root.textContent = '';
    const p = document.createElement('p');
    p.className = 'q-error__message';
    p.setAttribute('role', 'alert');
    p.textContent = str('error.boot', document.documentElement.lang === 'es' ? 'es' : 'en');
    root.appendChild(p);
  }
});
