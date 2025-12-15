import React, { useState, useEffect } from 'react';
import { View, Text, StatusBar, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useGeminiLive } from './hooks/useGeminiLive';
import Eyes from './components/Eyes';
import Mouth from './components/Mouth';
import TranscriptView from './components/TranscriptView';
import SettingsModal from './components/SettingsModal';
import { UserSettings, EyeState, Emotion } from './types';
import { Sparkles, Settings2 } from 'lucide-react-native';

const API_KEY = Constants.expoConfig?.extra?.geminiApiKey || '';

const DEFAULT_SETTINGS: UserSettings = {
    userName: 'Owner',
    systemInstruction: 'You are NaNa, a helpful, witty, and concise AI assistant.',
    fileContext: '',
    language: 'en',
    translationLangA: 'vi',
    translationLangB: 'en',
    apiKey: API_KEY,
    voiceSensitivity: 1.5,
};

const App: React.FC = () => {
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    const {
        state,
        active,
        volume,
        connect,
        disconnect,
        error,
        messages,
        currentTranscript,
        isUserSpeaking
    } = useGeminiLive(settings, null);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (error) {
            Alert.alert("Connection Error", error);
        }
    }, [error]);

    const handleToggle = () => {
        if (!settings.apiKey) {
            Alert.alert("Configuration Missing", "Please add your Gemini API Key in the settings or .env file.");
            setShowSettings(true);
            return;
        }
        if (active) disconnect();
        else connect();
    };

    const hours = currentTime.getHours().toString().padStart(2, '0');
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');

    let currentEmotion = Emotion.NEUTRAL;
    if (state === EyeState.SPEAKING) currentEmotion = Emotion.HAPPY;
    if (state === EyeState.THINKING) currentEmotion = Emotion.SURPRISED;

    return (
        <SafeAreaProvider>
            <LinearGradient
                colors={['#0f0c29', '#302b63', '#24243e']}
                style={{ flex: 1 }}
            >
                <StatusBar barStyle="light-content" />
                <SafeAreaView className="flex-1 justify-between">

                    {/* Header */}
                    <View className="flex-row justify-between items-center px-6 mt-2">
                        <View>
                            <Text className="text-white text-4xl font-thin tracking-widest">
                                {hours}<Text className="text-purple-400">:</Text>{minutes}
                            </Text>
                            <Text className="text-purple-200/50 text-xs uppercase tracking-[0.4em]">NaNa AI</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowSettings(true)}
                            className="p-3 bg-white/10 rounded-full border border-white/10"
                        >
                            <Settings2 size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Avatar Section */}
                    <View className="items-center justify-center flex-1 my-4">
                        <View className={`absolute w-80 h-80 rounded-full bg-purple-600/30 blur-3xl ${active ? 'opacity-100' : 'opacity-20'}`} />

                        <View className="scale-110">
                            <Eyes state={state} emotion={currentEmotion} volume={volume} />
                            <Mouth eyeState={state} emotion={currentEmotion} volume={volume} />
                        </View>

                        {/* Status Pill */}
                        <View className={`mt-8 px-5 py-2 rounded-full border flex-row items-center gap-2 ${active ? 'border-purple-400/30 bg-purple-900/40' : 'border-white/10 bg-black/40'}`}>
                            <View className={`w-2 h-2 rounded-full ${active ? 'bg-green-400 animate-pulse' : 'bg-neutral-500'}`} />
                            <Text className={`text-xs uppercase tracking-widest font-semibold ${active ? 'text-purple-100' : 'text-neutral-500'}`}>
                                {active ? (state === EyeState.LISTENING ? "Listening" : state) : "Standby"}
                            </Text>
                        </View>
                    </View>

                    {/* Transcript Area */}
                    {active && (messages.length > 0 || currentTranscript) ? (
                        <View className="h-1/3 w-full">
                            <TranscriptView
                                messages={messages}
                                currentTranscript={currentTranscript}
                                isUserSpeaking={isUserSpeaking}
                            />
                        </View>
                    ) : <View className="h-1/3" />}

                    {/* Bottom Controls */}
                    <View className="px-8 mb-6 w-full">
                        <TouchableOpacity
                            onPress={handleToggle}
                            activeOpacity={0.8}
                            className={`w-full py-5 rounded-3xl flex-row items-center justify-center gap-3 shadow-2xl ${active
                                    ? 'bg-neutral-900 border border-white/10'
                                    : 'bg-white'
                                }`}
                        >
                            {active ? (
                                <View className="w-4 h-4 rounded-sm bg-red-500" />
                            ) : (
                                <Sparkles size={24} color="#9333ea" />
                            )}
                            <Text className={`font-bold text-lg tracking-wider uppercase ${active ? 'text-white' : 'text-purple-900'}`}>
                                {active ? "End Session" : "Start Conversation"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Settings Modal */}
                    <SettingsModal
                        visible={showSettings}
                        onClose={() => setShowSettings(false)}
                        settings={settings}
                        onSave={setSettings}
                    />

                </SafeAreaView>
            </LinearGradient>
        </SafeAreaProvider>
    );
};

export default App;