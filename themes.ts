import { createV5Theme, defaultChildrenThemes } from "@tamagui/config/v5";
import { v5ComponentThemes } from "@tamagui/themes/v5";
import { yellow, yellowDark, red, redDark, green, greenDark } from "@tamagui/colors";

const darkPalette = [
    "hsla(32, 15%, 27%, 1)",
    "hsla(32, 16%, 25%, 1)",
    "hsla(32, 17%, 24%, 1)",
    "hsla(32, 18%, 22%, 1)",
    "hsla(110, 18%, 32%, 1)",
    "hsla(188, 19%, 43%, 1)",
    "hsla(135, 19%, 45%, 1)",
    "hsla(83, 20%, 48%, 1)",
    "hsla(30, 20%, 50%, 1)",
    "hsla(28, 22%, 85%, 1)",
    "hsla(25, 25%, 95%, 1)",
    "hsla(22, 28%, 98%, 1)",
];
const lightPalette = [
    "hsla(32, 25%, 97%, 1)",
    "hsla(31, 27%, 93%, 1)",
    "hsla(31, 28%, 89%, 1)",
    "hsla(30, 30%, 85%, 1)",
    "hsla(29, 31%, 74%, 1)",
    "hsla(27, 33%, 64%, 1)",
    "hsla(26, 33%, 59%, 1)",
    "hsla(26, 34%, 55%, 1)",
    "hsla(25, 35%, 50%, 1)",
    "hsla(20, 40%, 20%, 1)",
    "hsla(15, 45%, 10%, 1)",
    "hsla(10, 50%, 5%, 1)",
];

// Your custom accent color theme
const accentLight = {
    accent1: "hsla(180, 50%, 70%, 1)",
    accent2: "hsla(180, 48%, 68%, 1)",
    accent3: "hsla(180, 45%, 65%, 1)",
    accent4: "hsla(35, 60%, 60%, 1)",
    accent5: "hsla(36, 59%, 58%, 1)",
    accent6: "hsla(37, 58%, 56%, 1)",
    accent7: "hsla(38, 57%, 54%, 1)",
    accent8: "hsla(39, 56%, 52%, 1)",
    accent9: "hsla(40, 55%, 50%, 1)",
    accent10: "hsla(30, 65%, 35%, 1)",
    accent11: "hsla(28, 70%, 30%, 1)",
    accent12: "hsla(25, 75%, 25%, 1)",
};

const accentDark = {
    accent1: "hsla(180, 60%, 30%, 1)",
    accent2: "hsla(180, 57%, 32%, 1)",
    accent3: "hsla(180, 55%, 35%, 1)",
    accent4: "hsla(35, 70%, 40%, 1)",
    accent5: "hsla(36, 69%, 44%, 1)",
    accent6: "hsla(37, 68%, 48%, 1)",
    accent7: "hsla(38, 67%, 52%, 1)",
    accent8: "hsla(39, 66%, 56%, 1)",
    accent9: "hsla(40, 65%, 60%, 1)",
    accent10: "hsla(45, 50%, 80%, 1)",
    accent11: "hsla(48, 45%, 90%, 1)",
    accent12: "hsla(50, 40%, 95%, 1)",
};

const builtThemes = createV5Theme({
    darkPalette,
    lightPalette,
    componentThemes: v5ComponentThemes,
    accent: {
        light: accentLight,
        dark: accentDark,
    },
    childrenThemes: {
        // Include default color themes (blue, red, green, yellow, etc.)
        ...defaultChildrenThemes,

        // Semantic color themes for warnings, errors, and success states
        warning: {
            light: yellow,
            dark: yellowDark,
        },
        error: {
            light: red,
            dark: redDark,
        },
        success: {
            light: green,
            dark: greenDark,
        },
    },
});

export type Themes = typeof builtThemes;

// the process.env conditional here is optional but saves web client-side bundle
// size by leaving out themes JS. tamagui automatically hydrates themes from CSS
// back into JS for you, and the bundler plugins set TAMAGUI_ENVIRONMENT. so
// long as you are using the Vite, Next, Webpack plugins this should just work,
// but if not you can just export builtThemes directly as themes:
export const themes: Themes =
    process.env.TAMAGUI_ENVIRONMENT === "client" && process.env.NODE_ENV === "production"
        ? ({} as Themes)
        : builtThemes;
