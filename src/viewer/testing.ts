// Development build only; Vite removes this module from the production graph.
import { Engine } from './engine';
import { sanitizeSvg } from './sanitize-svg';
Object.assign(globalThis, { rhwpTesting: { Engine, sanitizeSvg } });
