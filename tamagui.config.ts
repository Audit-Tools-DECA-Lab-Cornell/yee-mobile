import { defaultConfig } from '@tamagui/config/v5'
import { createTamagui } from 'tamagui'
import { themes } from './themes'

export const config = createTamagui({
  ...defaultConfig,
  themes,
  media: {
    ...defaultConfig.media,
  },
})

type OurConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends OurConfig {}
}