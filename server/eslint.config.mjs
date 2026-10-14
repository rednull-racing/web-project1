import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
            ".vscode/**",
            "dist/**",
            "node_modules/**",
            "migrations/**",
            "seeders/**",
            "public/**",
            "tmp/**",
            "eslint.config.mjs",
            "scripts/**",
        ],
    },

    {
        files: ["src/**/*.ts"],
        extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    },

    {
        files: ["**/*.cjs"],
        languageOptions: {
            sourceType: "commonjs",
            globals: globals.node,
        },
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },
);
