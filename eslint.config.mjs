import next from "eslint-config-next";

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = [
  ...next,
  {
    ignores: [
      "**/*.config.js",
      "**/*.config.mjs",
      ".well-known/**",
      "app/.well-known/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];

export default config;
