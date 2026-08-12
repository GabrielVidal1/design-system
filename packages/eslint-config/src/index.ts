import js from "@eslint/js";
import type { Linter } from "eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * House rules that apply to every file, whatever the framework.
 *
 * - `max-lines` — no file grows past 300 lines of actual code (blank lines
 *   and comments don't count): past that, split it.
 */
export const houseRules: Linter.RulesRecord = {
  "max-lines": [
    "error",
    { max: 300, skipBlankLines: true, skipComments: true },
  ],
};

/**
 * Base config: TypeScript projects without React.
 * `@eslint/js` recommended + `typescript-eslint` recommended + house rules.
 */
export const base = tseslint.config(
  { ignores: ["dist", "dist-demo", "node_modules"] },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: houseRules,
  },
);

/**
 * React config (the default export): everything in `base`, plus
 * react-hooks + react-refresh recommended rules and the house rule that
 * a file holds exactly one React component (`react/no-multi-comp`,
 * stateless components included).
 */
export const react = tseslint.config(...base, {
  files: ["**/*.{ts,tsx,js,jsx}"],
  plugins: {
    react: reactPlugin,
    "react-hooks": reactHooks,
    "react-refresh": reactRefresh,
  },
  settings: { react: { version: "detect" } },
  rules: {
    ...reactHooks.configs.recommended.rules,
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "react/no-multi-comp": ["error", { ignoreStateless: false }],
  },
});

export default react;
