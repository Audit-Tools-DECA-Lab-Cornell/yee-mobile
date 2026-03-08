import { defaultConfig } from "@tamagui/config/v5";
import { createTamagui } from "tamagui";
import { themes } from "./themes";

export const config = createTamagui({
    ...defaultConfig,
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
