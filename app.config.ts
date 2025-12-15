import 'dotenv/config';

export default {
    expo: {
        name: "NaNa Assistant",
        slug: "nana-assistant",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/icon.png",
        userInterfaceStyle: "dark",
        splash: {
            "image": "./assets/splash.png",
            "resizeMode": "contain",
            "backgroundColor": "#000000"
        },
        assetBundlePatterns: [
            "**/*"
        ],
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.nana.assistant",
            infoPlist: {
                NSMicrophoneUsageDescription: "NaNa needs access to your microphone to listen to your commands."
            }
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/adaptive-icon.png",
                backgroundColor: "#000000"
            },
            package: "com.nana.assistant",
            permissions: [
                "android.permission.RECORD_AUDIO",
                "android.permission.INTERNET",
                "android.permission.MODIFY_AUDIO_SETTINGS"
            ]
        },
        plugins: [
            [
                "expo-av",
                {
                    "microphonePermission": "Allow NaNa to access your microphone."
                }
            ],
            [
                "expo-build-properties",
                {
                    "android": {
                        "usesCleartextTraffic": true
                    }
                }
            ]
        ],
        extra: {
            geminiApiKey: process.env.GEMINI_API_KEY,
        }
    }
};