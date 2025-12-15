
import React, { useMemo } from 'react';
import { Modal, View, TouchableOpacity, Text, Dimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { X, ExternalLink } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { VideoState } from '../types';

interface VideoPlayerProps {
    state: VideoState;
    onClose: () => void;
}

const { width, height } = Dimensions.get('window');

const VideoPlayer: React.FC<VideoPlayerProps> = ({ state, onClose }) => {
    const videoSource = useMemo(() => {
        if (!state.url) return null;

        let videoId = '';
        const url = state.url;

        // 1. Check for standard YouTube URL
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);

        if (match && match[2].length === 11) {
            videoId = match[2];
        } else if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
            // 2. Assume it is a raw ID
            videoId = url;
        }

        if (videoId) {
            return { uri: `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&playsinline=1` };
        }

        // 3. Fallback: Search query
        const query = encodeURIComponent(state.title || url);
        return { uri: `https://www.youtube.com/results?search_query=${query}` };

    }, [state.url, state.title]);

    if (!state.isOpen) return null;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={state.isOpen}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/80 justify-center items-center">
                <BlurView intensity={20} tint="dark" className="absolute inset-0" />

                <View className="w-full h-full max-w-2xl bg-black shadow-2xl overflow-hidden" style={{ height: height * 0.4, width: width }}>
                    {/* Header */}
                    <View className="flex-row justify-between items-center p-4 bg-neutral-900 border-b border-white/10">
                        <View className="flex-1 mr-4">
                            <Text className="text-white font-bold text-lg" numberOfLines={1}>
                                {state.title || "YouTube Player"}
                            </Text>
                            <Text className="text-gray-400 text-xs" numberOfLines={1}>
                                {state.url}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-white/10 rounded-full">
                            <X color="white" size={24} />
                        </TouchableOpacity>
                    </View>

                    {/* Webview */}
                    <View className="flex-1 bg-black">
                        {videoSource ? (
                            <WebView
                                source={videoSource}
                                allowsFullscreenVideo
                                javaScriptEnabled
                                domStorageEnabled
                                startInLoadingState
                                containerStyle={{ flex: 1 }}
                                className="flex-1"
                            />
                        ) : (
                            <View className="flex-1 justify-center items-center">
                                <Text className="text-white">Invalid Video URL</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default VideoPlayer;
