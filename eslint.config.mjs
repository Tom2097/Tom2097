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
      "components/ui/use-mobile.tsx",
    ],
  },
];

export default config;
