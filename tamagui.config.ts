import { createAnimations } from "@tamagui/animations-react-native";
import { defaultConfig } from "@tamagui/config/v5";
import { createFont, createTamagui } from "tamagui";
import { themes } from "./themes";

/**
 * React Native animation driver. `@tamagui/config/v5`'s `defaultConfig` ships no
 * `animations`, and animated components (notably `Sheet`) require one - without
 * it they throw `Cannot read property 'setValue' of undefined`. These presets are
 * referenced by name via the `animation` prop.
 */
const animations = createAnimations({
    "100ms": { type: "timing", duration: 100 },
    quick: { type: "spring", damping: 20, mass: 1.2, stiffness: 250 },
    bouncy: { type: "spring", damping: 10, mass: 0.9, stiffness: 100 },
    medium: { type: "spring", damping: 15, mass: 1, stiffness: 120 },
    lazy: { type: "spring", damping: 20, stiffness: 60 },
    slow: { type: "spring", damping: 15, stiffness: 40 },
});

/**
 * Create a Tamagui font token backed by a single native family.
 *
 * @param family Native font family name loaded through `expo-font`.
 * @param sourceFont Base Tamagui font token to inherit sizing from.
 * @returns Tamagui font configuration for the given family.
 */
function createStaticFont(family: string, sourceFont: typeof defaultConfig.fonts.body) {
    return createFont({
        ...sourceFont,
        family,
        face: {
            400: { normal: family },
            500: { normal: family },
            600: { normal: family },
            700: { normal: family },
        },
    });
}

const bodyFont = createStaticFont("Geist-Regular", defaultConfig.fonts.body);
const bodyMediumFont = createStaticFont("Geist-Medium", defaultConfig.fonts.body);
const bodySemiBoldFont = createStaticFont("Geist-SemiBold", defaultConfig.fonts.body);
const bodyBoldFont = createStaticFont("Geist-Bold", defaultConfig.fonts.body);
const headingMediumFont = createStaticFont("Geist-SemiBold", defaultConfig.fonts.heading);
const headingBoldFont = createStaticFont("Geist-Bold", defaultConfig.fonts.heading);
const monoFont = createStaticFont("JetBrainsMono-Regular", defaultConfig.fonts.body);
const monoMediumFont = createStaticFont("JetBrainsMono-Medium", defaultConfig.fonts.body);
const monoBoldFont = createStaticFont("JetBrainsMono-Bold", defaultConfig.fonts.body);
const dyslexicFont = createStaticFont("OpenDyslexic-Regular", defaultConfig.fonts.body);
const dyslexicBoldFont = createStaticFont("OpenDyslexic-Bold", defaultConfig.fonts.body);

export const config = createTamagui({
    ...defaultConfig,
    animations,
    fonts: {
        ...defaultConfig.fonts,
        body: bodyFont,
        bodyMedium: bodyMediumFont,
        bodySemiBold: bodySemiBoldFont,
        bodyBold: bodyBoldFont,
        heading: headingBoldFont,
        headingMedium: headingMediumFont,
        headingBold: headingBoldFont,
        mono: monoFont,
        monoMedium: monoMediumFont,
        monoBold: monoBoldFont,
        dyslexic: dyslexicFont,
        dyslexicBold: dyslexicBoldFont,
    },
    themes,
    media: {
        ...defaultConfig.media,
    },
});

type OurConfig = typeof config;

declare module "tamagui" {
    // This is required for Tamagui module augmentation.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface TamaguiCustomConfig extends OurConfig {}
}

export default config;
