export default {
    expo: {
        name: "Youth Enabling Environments Audit Tool",
        slug: "audit-tools-yee-mobile",
        version: "0.1.0",
        orientation: "portrait",
        icon: "./assets/images/icon.png",
        scheme: "yee-mobile",
        userInterfaceStyle: "automatic",
        splash: {
            image: "./assets/images/splash.png",
            resizeMode: "contain",
            backgroundColor: "#F7F1EB",
        },
        assetBundlePatterns: ["**/*"],
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.andisha2004.yee-mobile",
            appleTeamId: "ZD947U862S",
            infoPlist: {
                ITSAppUsesNonExemptEncryption: false,
            },
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/images/adaptive-icon.png",
                backgroundColor: "#F7F1EB",
                monochromeImage: "./assets/images/adaptive-monochrome.png",
            },
            package: "com.andisha2004.audittoolsyeemobile",
        },
        plugins: [
            "./plugins/withCustomPodfilePatches",
            "expo-router",
            "expo-font",
            [
                "expo-build-properties",
                {
                    ios: {
                        newArchEnabled: true,
                        deploymentTarget: "15.1",
                        buildReactNativeFromSource: true,
                    },
                    android: {
                        newArchEnabled: true,
                        compileSdkVersion: 36,
                        targetSdkVersion: 36,
                        buildToolsVersion: "36.0.0",
                    },
                },
            ],
            "expo-web-browser",
            "expo-secure-store",
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
            policy: "appVersion",
        },
        // owner: "audit-tools-deca-lab-cornell",
        // githubUrl: "https://github.com/audit-tools-deca-lab-cornell/yee-mobile",
    },
};
