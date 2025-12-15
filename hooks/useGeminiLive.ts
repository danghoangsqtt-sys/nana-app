import { useEffect, useRef, useState, useCallback } from 'react';
import { LiveService } from '../services/liveService';
import { EyeState, UserSettings, UserLocation, ChatMessage, AppMode } from '../types';

export const useGeminiLive = (settings: UserSettings, location: UserLocation | null, mode: AppMode) => {
  const [state, setState] = useState<EyeState>(EyeState.IDLE);
  const [isActive, setIsActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Transcripts
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  const serviceRef = useRef<LiveService | null>(null);

  const connect = useCallback(() => {
    const effectiveApiKey = settings.apiKey || process.env.API_KEY || "";
    if (!effectiveApiKey) {
      setError("Missing API Key");
      return;
    }

    if (serviceRef.current) {
      serviceRef.current.disconnect();
    }

    const service = new LiveService(effectiveApiKey);

    service.onStateChange = (s) => setState(s);
    service.onVolumeChange = (v) => setVolume(v);
    service.onError = (msg) => setError(msg);
    service.onDisconnect = () => {
      serviceRef.current = null;
      setIsActive(false);
      setState(EyeState.IDLE);
      setIsUserSpeaking(false);
      setCurrentTranscript('');
    };

    // Transcript Handling
    service.onTranscript = (text, isUser, isFinal) => {
      if (isFinal) {
        setMessages(prev => [...prev, {
          role: isUser ? 'user' : 'model',
          text: text,
          timestamp: Date.now()
        }]);
        setCurrentTranscript('');
        setIsUserSpeaking(false);
      } else {
        setCurrentTranscript(text);
        setIsUserSpeaking(isUser);
      }
    };

    // Pass the mode to the service
    service.connect(settings, location, mode);
    serviceRef.current = service;
    setIsActive(true);
    setError(null);
  }, [settings, location, mode]);

  const disconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current = null;
    }
    setState(EyeState.IDLE);
    setIsActive(false);
  }, []);

  useEffect(() => {
    // If mode changes while active, we need to reconnect (optional, or just disconnect)
    // For now, we rely on the parent to call connect() again if they want to switch context.
    // But if unmounting, we always disconnect.
    return () => disconnect();
  }, [disconnect]);

  return {
    state,
    volume,
    connect,
    disconnect,
    active: isActive,
    error,
    messages,
    currentTranscript,
    isUserSpeaking
  };
};