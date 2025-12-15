
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Alert, Animated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { X, MessageSquare, Trash2, Plus, History } from 'lucide-react-native';
import { ChatSession } from '../types';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectSession: (session: ChatSession) => void;
    currentSessionId?: string;
}

const STORAGE_KEY = 'chat_sessions_v1';
const { width } = Dimensions.get('window');

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onSelectSession, currentSessionId }) => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadSessions();
        }
    }, [isOpen]);

    const loadSessions = async () => {
        try {
            const json = await AsyncStorage.getItem(STORAGE_KEY);
            if (json) {
                const parsed = JSON.parse(json);
                // Sort by date desc
                parsed.sort((a: ChatSession, b: ChatSession) => b.updatedAt - a.updatedAt);
                setSessions(parsed);
            }
        } catch (e) {
            console.error("Failed to load sessions", e);
        }
    };

    const createNewSession = async () => {
        const newSession: ChatSession = {
            id: Date.now().toString(),
            title: 'New Conversation',
            messages: [],
            updatedAt: Date.now()
        };

        const updatedSessions = [newSession, ...sessions];
        await saveSessions(updatedSessions);
        onSelectSession(newSession);
        onClose();
    };

    const deleteSession = async (id: string) => {
        Alert.alert(
            "Delete Chat",
            "Are you sure you want to delete this conversation?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const updated = sessions.filter(s => s.id !== id);
                        await saveSessions(updated);
                    }
                }
            ]
        );
    };

    const saveSessions = async (newSessions: ChatSession[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSessions));
            setSessions(newSessions);
        } catch (e) {
            console.error("Failed to save sessions", e);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            animationType="none"
            transparent={true}
            visible={isOpen}
            onRequestClose={onClose}
        >
            <View className="flex-1 flex-row">
                {/* Sidebar Content */}
                <Animated.View
                    className="h-full bg-neutral-900 border-r border-white/10"
                    style={{ width: width * 0.8 }}
                >
                    <View className="flex-1 bg-black/50">
                        {/* Header */}
                        <View className="flex-row justify-between items-center p-6 pt-12 border-b border-white/10 bg-black/20">
                            <Text className="text-white text-xl font-light tracking-[3px]">HISTORY</Text>
                            <TouchableOpacity onPress={onClose} className="p-2">
                                <X color="white" size={24} />
                            </TouchableOpacity>
                        </View>

                        {/* New Chat Button */}
                        <View className="p-4">
                            <TouchableOpacity
                                onPress={createNewSession}
                                className="flex-row items-center justify-center gap-2 bg-purple-600 p-4 rounded-xl shadow-lg shadow-purple-900/50"
                            >
                                <Plus color="white" size={20} />
                                <Text className="text-white font-bold tracking-widest">NEW CHAT</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Session List */}
                        <ScrollView className="flex-1 px-4">
                            {sessions.length === 0 ? (
                                <View className="items-center justify-center mt-20 opacity-50">
                                    <History size={48} color="white" />
                                    <Text className="text-white mt-4">No history yet</Text>
                                </View>
                            ) : (
                                sessions.map((session) => (
                                    <TouchableOpacity
                                        key={session.id}
                                        onPress={() => {
                                            onSelectSession(session);
                                            onClose();
                                        }}
                                        className={`mb-3 p-4 rounded-xl border flex-row justify-between items-center ${session.id === currentSessionId
                                                ? 'bg-white/10 border-purple-500'
                                                : 'bg-black/40 border-white/5'
                                            }`}
                                    >
                                        <View className="flex-1 flex-row gap-3 items-center">
                                            <MessageSquare size={16} color={session.id === currentSessionId ? '#c084fc' : '#666'} />
                                            <View>
                                                <Text className={`font-medium ${session.id === currentSessionId ? 'text-white' : 'text-gray-400'}`} numberOfLines={1}>
                                                    {session.title || "Untitled Chat"}
                                                </Text>
                                                <Text className="text-gray-600 text-xs mt-1">
                                                    {new Date(session.updatedAt).toLocaleDateString()} • {session.messages.length} msgs
                                                </Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity onPress={() => deleteSession(session.id)} className="p-2">
                                            <Trash2 size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </Animated.View>

                {/* Backdrop / Close area */}
                <TouchableOpacity
                    className="flex-1 bg-black/50"
                    activeOpacity={1}
                    onPress={onClose}
                >
                    <BlurView intensity={10} tint="dark" className="flex-1" />
                </TouchableOpacity>
            </View>
        </Modal>
    );
};

export default Sidebar;
