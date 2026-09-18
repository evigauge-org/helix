import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Known debt, inherited from pre-open-source development: 66 occurrences
      // of `any` across app/, lib/ and components/. Typing them out properly is
      // real work that touches behaviour, so it is being paid down rather than
      // fixed in one sweep. Kept as a warning, not silenced, so every CI run
      // still reports the count and the number can only go down.
      "@typescript-eslint/no-explicit-any": "warn",

      // These seven are real correctness smells, not style: setState called
      // synchronously inside an effect (cascading renders), components created
      // during render (remounts and lost state), and Date.now() called during
      // render (impure). They are inherited and each needs its component
      // understood before it is touched, so they are surfaced as warnings to be
      // fixed rather than silenced. Do not delete these lines — fix the code and
      // then delete them.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
