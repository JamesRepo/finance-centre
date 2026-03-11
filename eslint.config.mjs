import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
  {
    rules: {
      // Enforce `import type` for type-only imports
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // Catch unused variables but allow _-prefixed intentional ignores
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Discourage untyped code
      "@typescript-eslint/no-explicit-any": "warn",
      // Prevent stray console.log — allow console.warn/error
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Always use === and !==
      eqeqeq: ["error", "always"],
      // Require braces for multi-line blocks
      curly: ["error", "multi-line"],
      // Only throw Error objects
      "no-throw-literal": "error",
      // Use const when not reassigned
      "prefer-const": "error",
    },
  },
  // Allow console in scripts that are meant to log output
  {
    files: ["prisma/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
