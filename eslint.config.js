const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier/flat");

/**
 * Screens and components must consume tokens via useDesignSystem(); the static
 * designSystem export is reserved for module-level constants inside lib/.
 */
const restrictedDesignSystemImport = {
    name: "lib/design-system",
    importNames: ["designSystem"],
    message:
        "Use useDesignSystem(); the static export is only for module-level constants inside lib/.",
};

module.exports = defineConfig([
    expoConfig,
    prettierConfig,
    {
        ignores: [
            "scripts/**",
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
            "no-console": ["warn", { allow: ["warn", "error", "info"] }],
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
                    patterns: ["app/*", "components/*"],
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
                    paths: [restrictedDesignSystemImport],
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
                    paths: [restrictedDesignSystemImport],
                    patterns: ["app/*"],
                },
            ],
        },
    },
    {
        files: ["app/**/*.{ts,tsx}"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    paths: [restrictedDesignSystemImport],
                },
            ],
        },
    },
]);
