import { defaultConfig } from "@tamagui/config/v5";
import { createFont, createTamagui } from "tamagui";
import { themes } from "./themes";

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
const headingMediumFont = createStaticFont("SpaceGrotesk-Medium", defaultConfig.fonts.heading);
const headingBoldFont = createStaticFont("SpaceGrotesk-Bold", defaultConfig.fonts.heading);
const monoFont = createStaticFont("JetBrainsMono-Regular", defaultConfig.fonts.body);
const monoMediumFont = createStaticFont("JetBrainsMono-Medium", defaultConfig.fonts.body);
const monoBoldFont = createStaticFont("JetBrainsMono-Bold", defaultConfig.fonts.body);

export const config = createTamagui({
    ...defaultConfig,
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
