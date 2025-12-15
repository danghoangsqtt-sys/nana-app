import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Switch, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Save, KeyRound, MessageSquare, Languages, Globe, Activity } from 'lucide-react-native';
import { UserSettings } from '../types';

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
    settings: UserSettings;
    onSave: (newSettings: UserSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose, settings, onSave }) => {
    const [tempSettings, setTempSettings] = useState<UserSettings>(settings);
    const [sliderWidth, setSliderWidth] = useState(0);

    const handleSave = () => {
        onSave(tempSettings);
        onClose();
    };

    const handleSliderChange = (x: number) => {
        if (sliderWidth === 0) return;
        // Calculate percentage (0 to 1)
        const ratio = Math.max(0, Math.min(1, x / sliderWidth));
        // Map to 0 - 2.0
        const newValue = ratio * 2.0;
        setTempSettings(prev => ({ ...prev, voiceSensitivity: newValue }));
    };

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <BlurView intensity={90} tint="dark" className="flex-1 justify-center items-center px-4">
                <View className="w-full max-w-sm bg-neutral-900/90 rounded-3xl border border-white/10 overflow-hidden shadow-2xl h-[80%]">

                    {/* Header */}
                    <View className="flex-row justify-between items-center p-6 border-b border-white/5">
                        <Text className="text-xl font-light text-white tracking-[3px] uppercase">Configuration</Text>
                        <TouchableOpacity onPress={onClose} className="p-2 rounded-full bg-white/5">
                            <X color="white" size={20} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1">
                        <View className="p-6 gap-6">

                            {/* API Key */}
                            <View className="gap-2">
                                <View className="flex-row items-center gap-2">
                                    <KeyRound size={16} color="#a855f7" />
                                    <Text className="text-gray-400 text-xs uppercase tracking-[1px]">Gemini API Key</Text>
                                </View>
                                <TextInput
                                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white"
                                    placeholder="Paste your API key..."
                                    placeholderTextColor="#555"
                                    secureTextEntry
                                    value={tempSettings.apiKey}
                                    onChangeText={(t) => setTempSettings(prev => ({ ...prev, apiKey: t }))}
                                />
                            </View>

                            {/* System Instruction */}
                            <View className="gap-2">
                                <View className="flex-row items-center gap-2">
                                    <MessageSquare size={16} color="#a855f7" />
                                    <Text className="text-gray-400 text-xs uppercase tracking-[1px]">Assistant Persona</Text>
                                </View>
                                <TextInput
                                    className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white h-24"
                                    placeholder="Ex: You are a sarcastic robot..."
                                    placeholderTextColor="#555"
                                    multiline
                                    textAlignVertical="top"
                                    value={tempSettings.systemInstruction}
                                    onChangeText={(t) => setTempSettings(prev => ({ ...prev, systemInstruction: t }))}
                                />
                            </View>

                            {/* Primary Language */}
                            <View className="gap-2">
                                <View className="flex-row items-center gap-2">
                                    <Globe size={16} color="#a855f7" />
                                    <Text className="text-gray-400 text-xs uppercase tracking-[1px]">Primary Language</Text>
                                </View>
                                <View className="flex-row gap-3">
                                    <TouchableOpacity
                                        onPress={() => setTempSettings(prev => ({ ...prev, language: 'en' }))}
                                        className={`flex-1 py-3 rounded-xl border ${tempSettings.language === 'en' ? 'bg-purple-600/50 border-purple-400' : 'bg-black/30 border-white/10'}`}
                                    >
                                        <Text className={`text-center font-bold ${tempSettings.language === 'en' ? 'text-white' : 'text-gray-500'}`}>ENGLISH</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setTempSettings(prev => ({ ...prev, language: 'vi' }))}
                                        className={`flex-1 py-3 rounded-xl border ${tempSettings.language === 'vi' ? 'bg-purple-600/50 border-purple-400' : 'bg-black/30 border-white/10'}`}
                                    >
                                        <Text className={`text-center font-bold ${tempSettings.language === 'vi' ? 'text-white' : 'text-gray-500'}`}>VIETNAMESE</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Translator Config */}
                            <View className="gap-2 pt-2 border-t border-white/10">
                                <View className="flex-row items-center gap-2 mb-2">
                                    <Languages size={16} color="#38bdf8" />
                                    <Text className="text-sky-400 text-xs uppercase tracking-[1px]">Translator Config</Text>
                                </View>

                                <View className="flex-row gap-2">
                                    <View className="flex-1 gap-1">
                                        <Text className="text-gray-500 text-[10px] uppercase">Language A</Text>
                                        <TextInput
                                            className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white"
                                            placeholder="English"
                                            placeholderTextColor="#555"
                                            value={tempSettings.translationLangA}
                                            onChangeText={(t) => setTempSettings(prev => ({ ...prev, translationLangA: t }))}
                                        />
                                    </View>
                                    <View className="flex-1 gap-1">
                                        <Text className="text-gray-500 text-[10px] uppercase">Language B</Text>
                                        <TextInput
                                            className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white"
                                            placeholder="Vietnamese"
                                            placeholderTextColor="#555"
                                            value={tempSettings.translationLangB}
                                            onChangeText={(t) => setTempSettings(prev => ({ ...prev, translationLangB: t }))}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Voice Sensitivity Slider */}
                            <View className="gap-2 pt-2 border-t border-white/10">
                                <View className="flex-row justify-between items-center">
                                    <View className="flex-row items-center gap-2">
                                        <Activity size={16} color="#a855f7" />
                                        <Text className="text-gray-400 text-xs uppercase tracking-[1px]">Voice Sensitivity</Text>
                                    </View>
                                    <Text className="text-white font-bold">{tempSettings.voiceSensitivity?.toFixed(1) ?? "1.5"}</Text>
                                </View>

                                <View
                                    className="h-10 justify-center"
                                    onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
                                    onStartShouldSetResponder={() => true}
                                    onResponderGrant={(e) => handleSliderChange(e.nativeEvent.locationX)}
                                    onResponderMove={(e) => handleSliderChange(e.nativeEvent.locationX)}
                                >
                                    {/* Track */}
                                    <View className="h-1 bg-white/20 rounded-full overflow-hidden">
                                        <View
                                            className="h-full bg-purple-500"
                                            style={{ width: `${((tempSettings.voiceSensitivity || 0) / 2.0) * 100}%` }}
                                        />
                                    </View>
                                    {/* Thumb */}
                                    <View
                                        className="absolute w-5 h-5 bg-white rounded-full shadow-sm shadow-black"
                                        style={{
                                            left: `${((tempSettings.voiceSensitivity || 0) / 2.0) * 100}%`,
                                            transform: [{ translateX: -10 }]
                                        }}
                                    />
                                </View>
                            </View>

                            {/* Latency Optimization */}
                            <View className="flex-row justify-between items-center bg-black/30 p-4 rounded-xl mt-2">
                                <Text className="text-gray-300">Latency Optimization</Text>
                                <Switch
                                    value={tempSettings.optimizeLatency || false}
                                    onValueChange={(v) => setTempSettings(prev => ({ ...prev, optimizeLatency: v }))}
                                    trackColor={{ false: "#333", true: "#9333ea" }}
                                    thumbColor="#fff"
                                />
                            </View>
                        </View>
                    </ScrollView>

                    {/* Footer */}
                    <View className="p-6 pt-0">
                        <TouchableOpacity
                            onPress={handleSave}
                            className="bg-purple-600 w-full py-4 rounded-xl flex-row justify-center items-center gap-2 shadow-lg shadow-purple-900/50"
                        >
                            <Save size={20} color="white" />
                            <Text className="text-white font-bold tracking-[2px]">SAVE SETTINGS</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </BlurView>
        </Modal>
    );
};

export default SettingsModal;