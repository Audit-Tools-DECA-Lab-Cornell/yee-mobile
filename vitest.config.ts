import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        // Exclude the "react-native" import condition to break the RN import cycle in Node.
        conditions: ["node", "require", "default"],
        extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        alias: {
            app: path.resolve(__dirname, "app"),
            assets: path.resolve(__dirname, "assets"),
            components: path.resolve(__dirname, "components"),
            lib: path.resolve(__dirname, "lib"),
            stores: path.resolve(__dirname, "stores"),
        },
    },
    test: {
        environment: "node",
        include: ["tests/unit/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
        exclude: ["**/tamagui.config*", "**/tamagui.build*"],
        server: {
            deps: {
                inline: [
                    "tamagui",
                    "@tamagui/core",
                    "@tamagui/config",
                    "@tamagui/web",
                    "@tamagui/themes",
                ],
            },
        },
    },
});
