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
import { UserSettings, EyeState, Emotion, AppMode } from './types';
import { Sparkles, Settings2, Languages, Mic, MicOff } from 'lucide-react-native';

const API_KEY = Constants.expoConfig?.extra?.geminiApiKey || '';

const DEFAULT_SETTINGS: UserSettings = {
    userName: 'Owner',
    systemInstruction: 'You are NaNa, a helpful, witty, and concise AI assistant.',
    fileContext: '',
    language: 'en',
    translationLangA: 'English',
    translationLangB: 'Vietnamese',
    apiKey: API_KEY,
    voiceSensitivity: 1.5,
};

const App: React.FC = () => {
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [mode, setMode] = useState<AppMode>('assistant');

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
    } = useGeminiLive(settings, null, mode);

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

    const handleModeSwitch = () => {
        if (active) {
            Alert.alert("End Session", "Please end the current session before switching modes.");
            return;
        }
        setMode(prev => prev === 'assistant' ? 'translator' : 'assistant');
    };

    const hours = currentTime.getHours().toString().padStart(2, '0');
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');

    let currentEmotion = Emotion.NEUTRAL;
    if (state === EyeState.SPEAKING) currentEmotion = Emotion.HAPPY;
    if (state === EyeState.THINKING) currentEmotion = Emotion.SURPRISED;

    const isTranslator = mode === 'translator';
    const themeColor = isTranslator ? 'text-sky-400' : 'text-purple-400';
    const glowColor = isTranslator ? 'bg-sky-600/30' : 'bg-purple-600/30';
    const borderColor = isTranslator ? 'border-sky-400/30' : 'border-purple-400/30';

    return (
        <SafeAreaProvider>
            <LinearGradient
                colors={isTranslator ? ['#0f172a', '#1e293b', '#0c4a6e'] : ['#0f0c29', '#302b63', '#24243e']}
                style={{ flex: 1 }}
            >
                <StatusBar barStyle="light-content" />
                <SafeAreaView className="flex-1 justify-between">

                    {/* Header */}
                    <View className="flex-row justify-between items-center px-6 mt-2">
                        <View>
                            <Text className="text-white text-4xl font-thin tracking-[3px]">
                                {hours}<Text className={themeColor}>:</Text>{minutes}
                            </Text>
                            <Text className="text-white/50 text-xs uppercase tracking-[5px]">
                                {isTranslator ? "TRANSLATOR" : "NaNa AI"}
                            </Text>
                        </View>
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={handleModeSwitch}
                                className={`p-3 rounded-full border ${isTranslator ? 'bg-sky-500/20 border-sky-400/30' : 'bg-white/10 border-white/10'}`}
                            >
                                {isTranslator ? <Languages size={20} color="#38bdf8" /> : <Sparkles size={20} color="white" />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setShowSettings(true)}
                                className="p-3 bg-white/10 rounded-full border border-white/10"
                            >
                                <Settings2 size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Avatar Section */}
                    <View className="items-center justify-center flex-1 my-4">
                        <View className={`absolute w-80 h-80 rounded-full blur-3xl ${glowColor} ${active ? 'opacity-100' : 'opacity-20'}`} />

                        <View className="scale-110">
                            <Eyes state={state} emotion={currentEmotion} volume={volume} />
                            <Mouth eyeState={state} emotion={currentEmotion} volume={volume} />
                        </View>

                        {/* Status Pill */}
                        <View className={`mt-8 px-5 py-2 rounded-full border flex-row items-center gap-2 ${active ? borderColor + ' bg-black/40' : 'border-white/10 bg-black/20'}`}>
                            <View className={`w-2 h-2 rounded-full ${active ? (isTranslator ? 'bg-sky-400' : 'bg-green-400') : 'bg-red-500'}`} />
                            <Text className="text-white/80 text-xs font-medium uppercase tracking-widest">
                                {active ? (isTranslator ? `Trans: ${settings.translationLangA} ↔ ${settings.translationLangB}` : state) : "OFFLINE"}
                            </Text>
                        </View>
                    </View>

                    {/* Transcript & Controls */}
                    <View className="h-1/3 w-full justify-end pb-6">
                        <TranscriptView
                            messages={messages}
                            currentTranscript={currentTranscript}
                            isUserSpeaking={isUserSpeaking}
                        />

                        <View className="items-center px-6">
                            <TouchableOpacity
                                onPress={handleToggle}
                                className={`w-20 h-20 rounded-full items-center justify-center shadow-2xl border-4 ${active ? (isTranslator ? 'bg-sky-500 border-sky-400 shadow-sky-500/50' : 'bg-purple-600 border-purple-400 shadow-purple-500/50') : 'bg-neutral-800 border-neutral-700'}`}
                            >
                                {active ? <Mic size={32} color="white" /> : <MicOff size={32} color="#666" />}
                            </TouchableOpacity>
                        </View>
                    </View>

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