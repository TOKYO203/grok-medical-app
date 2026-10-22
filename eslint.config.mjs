import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Flat ESLint config for the TanStack Start app-builder template. */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".output/**",
      ".netlify/**",
      ".vercel/**",
      ".nitro/**",
      "node_modules/**",
      ".ux-backup/**",
      // Répertoires locaux de travail (sauvegardes, artefacts d'audit/QA) — liste
      // tenue en phase avec la section « Répertoires locaux de travail » du
      // .gitignore : tout ce qui est ignoré par git ne doit pas être linté.
      ".bak/**",
      ".audit-tmp/**",
      ".qa-tmp/**",
      ".admin-qa/**",
      "admin-local/**",
      ".devx/**",
      ".calc-tmp/**",
      ".optimus-backups/**",
      ".robust-backup/**",
      "screenshots/**",
      "attachments/**",
      "assets-src/**",
      "src/routeTree.gen.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Disable rules that conflict with Prettier formatting.
  prettier,
);
