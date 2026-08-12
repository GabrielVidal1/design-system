# @gabvdl/eslint-config

Shared ESLint **flat config** for gabvdl projects. It layers the good
recommended bases (`@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`,
`eslint-plugin-react-refresh`) and adds the house rules:

- **One React component per file** — `react/no-multi-comp` (stateless included).
- **No file over 300 lines of code** — `max-lines` (blank lines & comments
  don't count). Past that, split the file.

## Usage

```bash
npm i -D eslint @gabvdl/eslint-config
```

`eslint.config.js`:

```js
// React + TypeScript project (the default — what the homelab templates use):
import gabvdl from "@gabvdl/eslint-config";
export default gabvdl;
```

```js
// Plain TypeScript project (no React rules):
import { base } from "@gabvdl/eslint-config";
export default base;
```

Then `npx eslint .` (the templates wire it as `npm run lint`).

## Exports

| export       | contents                                                        |
| ------------ | --------------------------------------------------------------- |
| default      | `react` — the full TS + React config                            |
| `base`       | JS/TS recommended + house `max-lines`, no React                 |
| `react`      | `base` + react-hooks / react-refresh recommended + no-multi-comp |
| `houseRules` | just the framework-agnostic house rules, to graft elsewhere     |

Extend per-project by appending config objects after the import:

```js
import gabvdl from "@gabvdl/eslint-config";
export default [...gabvdl, { rules: { "max-lines": "off" } }];
```
