import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { ChatMessage } from '../types';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface TranscriptViewProps {
  messages: ChatMessage[];
  currentTranscript: string;
  isUserSpeaking: boolean;
}

const TranscriptView: React.FC<TranscriptViewProps> = ({ messages, currentTranscript, isUserSpeaking }) => {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages, currentTranscript]);

  return (
    <View className="flex-1 w-full px-4 mb-4 overflow-hidden rounded-2xl">
      <BlurView intensity={20} tint="dark" className="flex-1 rounded-2xl overflow-hidden border border-white/10">
        <ScrollView 
            ref={scrollViewRef}
            className="flex-1 p-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
        >
            {/* History */}
            {messages.map((msg, index) => (
                <Animated.View 
                    entering={FadeInUp.delay(100)}
                    key={`${index}-${msg.timestamp}`} 
                    className={`mb-3 flex-row ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    <View 
                        className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                            msg.role === 'user' 
                            ? 'bg-purple-600/80 rounded-tr-sm' 
                            : 'bg-neutral-800/80 rounded-tl-sm'
                        }`}
                    >
                        <Text className="text-white text-base leading-6 font-light">
                            {msg.text}
                        </Text>
                    </View>
                </Animated.View>
            ))}

            {/* Live Streaming Transcript */}
            {currentTranscript.length > 0 && (
                <Animated.View 
                    entering={FadeInUp}
                    className={`mb-3 flex-row ${isUserSpeaking ? 'justify-end' : 'justify-start'}`}
                >
                    <View 
                        className={`max-w-[85%] px-4 py-2 rounded-2xl border border-white/20 ${
                            isUserSpeaking
                            ? 'bg-purple-900/40 rounded-tr-sm' 
                            : 'bg-neutral-800/40 rounded-tl-sm'
                        }`}
                    >
                        <Text className="text-gray-200 text-base leading-6 font-light italic">
                            {currentTranscript}...
                        </Text>
                    </View>
                </Animated.View>
            )}
        </ScrollView>
      </BlurView>
    </View>
  );
};

export default TranscriptView;