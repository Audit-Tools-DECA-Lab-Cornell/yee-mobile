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
]);
