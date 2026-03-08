const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier/flat");

module.exports = defineConfig([
    expoConfig,
    prettierConfig,
    {
        ignores: [
            "android/**",
            "ios/**",
            ".expo/**",
            "node_modules/**",
            "dist/**",
            "coverage/**",
            "tamagui.generated.css",
            "tamagui-web.css",
        ],
    },
    {
        files: ["**/*.{js,jsx,ts,tsx}"],
        rules: {
            "no-console": ["warn", { allow: ["warn", "error"] }],
        },
    },
    {
        files: ["**/*.{ts,tsx}"],
        rules: {
            "@typescript-eslint/no-explicit-any": "error",
        },
    },
    {
        files: ["lib/**/*.{ts,tsx}"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: ["app/*", "components/*", "stores/*"],
                },
            ],
        },
    },
    {
        files: ["stores/**/*.{ts,tsx}"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: ["app/*", "components/*"],
                },
            ],
        },
    },
    {
        files: ["components/**/*.{ts,tsx}"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: ["app/*"],
                },
            ],
        },
    },
]);
