
export interface UserSettings {
  userName: string;
  systemInstruction: string;
  fileContext: string;
  language: 'vi' | 'en';
  translationLangA: string;
  translationLangB: string;
  apiKey?: string;
  optimizeLatency?: boolean;
  voiceSensitivity: number;
  userVoiceSample?: string;
}

export enum EyeState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  SPEAKING = 'SPEAKING',
  THINKING = 'THINKING',
  SLEEP = 'SLEEP'
}

export enum Emotion {
  NEUTRAL = 'NEUTRAL',
  HAPPY = 'HAPPY',
  EXCITED = 'EXCITED',
  SAD = 'SAD',
  SURPRISED = 'SURPRISED',
  ANGRY = 'ANGRY',
}

export interface UserLocation {
  lat: number;
  lng: number;
  address?: string;
}

export type AppMode = 'assistant' | 'translator';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface VideoState {
  isOpen: boolean;
  url: string;
  title: string;
}

export interface VideoCommand {
  url: string;
  title: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  isPinned?: boolean;
}
