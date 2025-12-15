
import { useEffect, useRef, useState, useCallback } from 'react';
import { LiveService } from '../services/liveService';
import { EyeState, UserSettings, UserLocation, ChatMessage, AppMode, VideoCommand } from '../types';

export const useGeminiLive = (settings: UserSettings, location: UserLocation | null, mode: AppMode) => {
  const [state, setState] = useState<EyeState>(EyeState.IDLE);
  const [isActive, setIsActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Transcripts
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  // Tool States (Exposed to App)
  const [videoCommand, setVideoCommand] = useState<VideoCommand | null>(null);
  const [openSettingsRequest, setOpenSettingsRequest] = useState(0); // Increment to trigger
  const [sleepRequest, setSleepRequest] = useState(0);

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

    // Standard Callbacks
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

    // Tool Callbacks
    service.onVideoCommand = (cmd) => setVideoCommand(cmd);
    service.onSettingsCommand = () => setOpenSettingsRequest(prev => prev + 1);
    service.onSleepCommand = () => setSleepRequest(prev => prev + 1);

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
    // Cleanup on unmount
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
    isUserSpeaking,
    videoCommand,
    openSettingsRequest,
    sleepRequest,
    clearVideoCommand: () => setVideoCommand(null)
  };
};
