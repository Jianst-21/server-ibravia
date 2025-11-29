import eslint from "@eslint/js";
import globals from "globals";

export default [
  // Recommended base rules
  eslint.configs.recommended,

  {
    files: ["**/*.js"],
    ignores: ["node_modules"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },

    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      semi: ["error", "always"],
      quotes: ["error", "double"],
      "no-console": "off",
    },
  },
];
