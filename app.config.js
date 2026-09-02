export default {
    expo: {
        name: "Youth Enabling Environments Audit Tool",
        slug: "audit-tools-yee-mobile",
        version: "0.10.0",
        orientation: "portrait",
        icon: "./assets/icon.png",
        scheme: "yee-mobile",
        userInterfaceStyle: "automatic",
        assetBundlePatterns: ["**/*"],
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.andisha2004.audit-tools-yee-mobile",
            appleTeamId: "ZD947U862S",
            infoPlist: {
                ITSAppUsesNonExemptEncryption: false,
            },
        },
        android: {
            icon: "./assets/icon.png",
            softwareKeyboardLayoutMode: "resize",
            adaptiveIcon: {
                foregroundImage: "./assets/images/adaptive-icon.png",
                backgroundColor: "#F7F1EB",
                monochromeImage: "./assets/images/adaptive-monochrome.png",
            },
            package: "com.andisha2004.audittoolsyeemobile",
        },
        plugins: [
            "./plugins/withCustomPodfilePatches",
            ["expo-navigation-bar", { hidden: true }],
            "./plugins/withImmersiveNavBar",
            ["expo-navigation-bar", { hidden: true }],
            "expo-router",
            "expo-font",
            [
                "expo-build-properties",
                {
                    ios: {
                        newArchEnabled: false,
                        deploymentTarget: "15.1",
                    },
                    android: {
                        newArchEnabled: false,
                        compileSdkVersion: 36,
                        targetSdkVersion: 36,
                        buildToolsVersion: "36.0.0",
                    },
                },
            ],
            "expo-web-browser",
            "expo-secure-store",
            "expo-localization",
            [
                "@sentry/react-native",
                {
                    url: "https://sentry.io/",
                    organization: process.env.SENTRY_ORG,
                    project: process.env.SENTRY_PROJECT,
                },
            ],
            [
                "expo-splash-screen",
                {
                    backgroundColor: "#F7F1EB",
                    image: "./assets/images/splash-icon.png",
                    imageWidth: 200,
                    dark: {
                        backgroundColor: "#0E0E0E",
                        image: "./assets/images/splash-icon.png",
                    },
                },
            ],
        ],
        experiments: {
            typedRoutes: true,
        },
        jsEngine: "hermes",
        extra: {
            router: {},
            eas: {
                projectId: "34a0dc8b-bf74-4b5a-8d76-ac98418eccd3",
            },
        },
        runtimeVersion: {
            policy: "fingerprint",
        },
        owner: "yee-decalab-cornell",
        githubUrl: "https://github.com/audit-tools-deca-lab-cornell/yee-mobile",
        updates: {
            url: "https://u.expo.dev/34a0dc8b-bf74-4b5a-8d76-ac98418eccd3",
            enableTracking: true,
            enableBsdiffPatchSupport: true,
        },
    },
};
