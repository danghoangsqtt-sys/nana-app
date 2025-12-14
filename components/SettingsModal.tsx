import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Switch } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Save, KeyRound, MessageSquare } from 'lucide-react-native';
import { UserSettings } from '../types';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose, settings, onSave }) => {
  const [tempSettings, setTempSettings] = useState<UserSettings>(settings);

  const handleSave = () => {
    onSave(tempSettings);
    onClose();
  };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <BlurView intensity={90} tint="dark" className="flex-1 justify-center items-center px-4">
        <View className="w-full max-w-sm bg-neutral-900/90 rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
            
            {/* Header */}
            <View className="flex-row justify-between items-center p-6 border-b border-white/5">
                <Text className="text-xl font-light text-white tracking-widest uppercase">Configuration</Text>
                <TouchableOpacity onPress={onClose} className="p-2 rounded-full bg-white/5">
                    <X color="white" size={20} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View className="p-6 gap-6">
                
                {/* API Key */}
                <View className="gap-2">
                    <View className="flex-row items-center gap-2">
                        <KeyRound size={16} color="#a855f7" />
                        <Text className="text-gray-400 text-xs uppercase tracking-wider">Gemini API Key</Text>
                    </View>
                    <TextInput 
                        className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white"
                        placeholder="Paste your API key..."
                        placeholderTextColor="#555"
                        secureTextEntry
                        value={tempSettings.apiKey}
                        onChangeText={(t) => setTempSettings(prev => ({...prev, apiKey: t}))}
                    />
                </View>

                {/* System Instruction */}
                <View className="gap-2">
                    <View className="flex-row items-center gap-2">
                        <MessageSquare size={16} color="#a855f7" />
                        <Text className="text-gray-400 text-xs uppercase tracking-wider">System Instruction</Text>
                    </View>
                    <TextInput 
                        className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white h-24"
                        placeholder="Ex: You are a sarcastic robot..."
                        placeholderTextColor="#555"
                        multiline
                        textAlignVertical="top"
                        value={tempSettings.systemInstruction}
                        onChangeText={(t) => setTempSettings(prev => ({...prev, systemInstruction: t}))}
                    />
                </View>

                {/* Voice Sensitivity */}
                <View className="flex-row justify-between items-center bg-black/30 p-4 rounded-xl">
                    <Text className="text-gray-300">Latency Optimization</Text>
                    <Switch 
                        value={tempSettings.optimizeLatency || false}
                        onValueChange={(v) => setTempSettings(prev => ({...prev, optimizeLatency: v}))}
                        trackColor={{ false: "#333", true: "#9333ea" }}
                        thumbColor="#fff"
                    />
                </View>
            </View>

            {/* Footer */}
            <View className="p-6 pt-0">
                <TouchableOpacity 
                    onPress={handleSave}
                    className="bg-purple-600 w-full py-4 rounded-xl flex-row justify-center items-center gap-2 shadow-lg shadow-purple-900/50"
                >
                    <Save size={20} color="white" />
                    <Text className="text-white font-bold tracking-wider">SAVE SETTINGS</Text>
                </TouchableOpacity>
            </View>

        </View>
      </BlurView>
    </Modal>
  );
};

export default SettingsModal;