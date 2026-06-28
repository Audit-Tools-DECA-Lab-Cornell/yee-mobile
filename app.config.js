export default {
    expo: {
        name: "Youth Enabling Environments Audit Tool",
        slug: "audit-tools-yee-mobile",
        version: "0.1.0",
        orientation: "portrait",
        icon: "./assets/icon.png",
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
            icon: "./assets/icon.png",
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
        owner: "audit-tools-deca-lab-cornell",
        githubUrl: "https://github.com/audit-tools-deca-lab-cornell/yee-mobile",
    },
};
