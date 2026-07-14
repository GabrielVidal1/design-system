import { Prism } from 'prism-react-renderer';

// prismjs grammar components attach themselves to a global `Prism` — point it
// at prism-react-renderer's vendored instance BEFORE any grammar module runs
// (prism-langs.ts imports this module first, which guarantees the order).
(globalThis as Record<string, unknown>).Prism = Prism;
