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
      "app/(dashboard)/feedback/page.tsx",
      "app/auth/login/page.tsx",
      "app/onboarding/page.tsx",
      "app/onboarding/recommendations/page.tsx",
      "components/digit/help-support.tsx",
      "components/ui/carousel.tsx",
      "components/ui/sidebar.tsx",
      "components/ui/use-mobile.tsx",
      "hooks/use-mobile.ts",
    ],
  },
];

export default config;
