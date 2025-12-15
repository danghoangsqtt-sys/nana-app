import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Audio } from 'expo-av';
import LiveAudioStream from 'react-native-live-audio-stream';
import { UserSettings, EyeState, UserLocation, AppMode } from "../types";
import { wrapPcmWithWav } from "../utils/audioUtils";
import { Buffer } from 'buffer';

// Audio Config
const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BIT_DEPTH = 16;
const BUFFER_SIZE = 2048; // Size of emitted chunks

export class LiveService {
    private ai: GoogleGenAI;
    private session: any = null;

    // Audio Playback
    private isPlaying = false;
    private audioQueue: string[] = []; // Queue of base64 PCM chunks
    private currentSound: Audio.Sound | null = null;
    private nextSound: Audio.Sound | null = null; // Pre-loaded sound

    // State Management
    public onStateChange: (state: EyeState) => void = () => { };
    public onTranscript: (text: string, isUser: boolean, isFinal: boolean) => void = () => { };
    public onError: (message: string) => void = () => { };
    public onDisconnect: () => void = () => { };
    public onVolumeChange: (volume: number) => void = () => { };

    // Transcription State
    private currentInputTranscription = '';
    private currentOutputTranscription = '';

    constructor(apiKey: string) {
        this.ai = new GoogleGenAI({ apiKey });
    }

    async connect(settings: UserSettings, location: UserLocation | null, mode: AppMode) {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            // Initialize Input Stream
            const options = {
                sampleRate: SAMPLE_RATE,
                channels: CHANNELS,
                bitsPerSample: BIT_DEPTH,
                audioSource: 6, // Voice Recognition
                bufferSize: BUFFER_SIZE,
            };
            LiveAudioStream.init(options);

            // Gemini Config
            const config: any = {
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: { model: "google-1.0-pro-en" },
                    outputAudioTranscription: { model: "google-1.0-pro-en" },
                    systemInstruction: settings.systemInstruction || "You are NaNa.",
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                    },
                },
                callbacks: {
                    onopen: this.handleOpen.bind(this),
                    onmessage: this.handleMessage.bind(this),
                    onclose: () => {
                        this.cleanup();
                        this.onDisconnect();
                    },
                    onerror: (e: any) => this.onError(e.message || "Connection Error"),
                }
            };

            this.session = await this.ai.live.connect(config);

        } catch (e: any) {
            this.onError(e.message);
            this.onDisconnect();
        }
    }

    private handleOpen() {
        console.log("Connected to Gemini Live");
        this.onStateChange(EyeState.LISTENING);

        // Start Streaming Input
        LiveAudioStream.on('data', (data) => {
            // 'data' is a base64 string of PCM
            if (this.session) {
                this.session.sendRealtimeInput({
                    media: {
                        mimeType: "audio/pcm;rate=16000",
                        data: data
                    }
                });

                // Simple volume calc for UI
                this.calculateVolume(data);
            }
        });
        LiveAudioStream.start();
    }

    private calculateVolume(base64: string) {
        // Crude RMS calculation for visualization
        // Taking a subset to save CPU
        const buffer = Buffer.from(base64, 'base64');
        let sum = 0;
        const step = 4;
        // Buffer trong Node/RN truy cập bằng index như mảng byte
        for (let i = 0; i < buffer.length; i += step) {
            const byte = buffer[i];
            // Lưu ý: PCM 16bit là 2 bytes, tính toán trên 1 byte chỉ là ước lượng biên độ
            sum += byte * byte;
        }
        const rms = Math.sqrt(sum / (raw.length / step));
        const normalized = Math.min(Math.max(rms / 10, 0), 100);
        this.onVolumeChange(normalized);
    }

    private async handleMessage(message: LiveServerMessage) {
        // 1. Transcriptions
        if (message.serverContent?.outputTranscription) {
            this.currentOutputTranscription += message.serverContent.outputTranscription.text;
            this.onTranscript(this.currentOutputTranscription, false, false);
        } else if (message.serverContent?.inputTranscription) {
            this.currentInputTranscription += message.serverContent.inputTranscription.text;
            this.onTranscript(this.currentInputTranscription, true, false);
        }

        if (message.serverContent?.turnComplete) {
            if (this.currentInputTranscription) {
                this.onTranscript(this.currentInputTranscription, true, true);
                this.currentInputTranscription = '';
            }
            if (this.currentOutputTranscription) {
                this.onTranscript(this.currentOutputTranscription, false, true);
                this.currentOutputTranscription = '';
            }

            if (!this.isPlaying && this.audioQueue.length === 0) {
                this.onStateChange(EyeState.LISTENING);
            }
        }

        // 2. Interruption handling (VAD from Server)
        if (message.serverContent?.interrupted) {
            console.log("Interrupted by server/user");
            await this.stopAudio();
            this.audioQueue = []; // Clear queue
            this.onStateChange(EyeState.LISTENING);
            return;
        }

        // 3. Audio Output
        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
            this.queueAudio(audioData);
        }
    }

    // --- AUDIO PLAYBACK (Memory/Stream Optimized) ---

    private queueAudio(base64Pcm: string) {
        this.audioQueue.push(base64Pcm);
        if (!this.isPlaying) {
            this.playNextChunk();
        } else {
            // Try to pre-load next chunk if we have one and no nextSound
            this.preloadNext();
        }
    }

    private async preloadNext() {
        if (this.nextSound || this.audioQueue.length === 0) return;

        const pcm = this.audioQueue[0]; // Peek
        try {
            const wavHeader = wrapPcmWithWav(pcm, 24000); // Gemini output is 24k
            const uri = `data:audio/wav;base64,${wavHeader}`;
            const { sound } = await Audio.Sound.createAsync({ uri });
            this.nextSound = sound;
        } catch (e) {
            console.log("Preload failed", e);
        }
    }

    private async playNextChunk() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            this.onStateChange(EyeState.LISTENING);
            return;
        }

        this.isPlaying = true;
        this.onStateChange(EyeState.SPEAKING);

        try {
            // Use preloaded sound if available, otherwise create it
            let soundToPlay: Audio.Sound;

            // Remove current chunk from queue
            const pcm = this.audioQueue.shift();

            if (this.nextSound) {
                soundToPlay = this.nextSound;
                this.nextSound = null;
            } else {
                const wavHeader = wrapPcmWithWav(pcm!, 24000);
                const uri = `data:audio/wav;base64,${wavHeader}`;
                const { sound } = await Audio.Sound.createAsync({ uri });
                soundToPlay = sound;
            }

            this.currentSound = soundToPlay;

            // Trigger preload for the *next* one while this plays
            this.preloadNext();

            soundToPlay.setOnPlaybackStatusUpdate(async (status) => {
                if (status.isLoaded && status.didJustFinish) {
                    await soundToPlay.unloadAsync();
                    this.currentSound = null;
                    this.playNextChunk();
                }
            });

            await soundToPlay.playAsync();

        } catch (e) {
            console.error("Playback error", e);
            this.isPlaying = false;
            this.playNextChunk();
        }
    }

    private async stopAudio() {
        this.isPlaying = false;
        if (this.currentSound) {
            try { await this.currentSound.stopAsync(); await this.currentSound.unloadAsync(); } catch { }
            this.currentSound = null;
        }
        if (this.nextSound) {
            try { await this.nextSound.unloadAsync(); } catch { }
            this.nextSound = null;
        }
    }

    public cleanup() {
        this.onStateChange(EyeState.IDLE);
        LiveAudioStream.stop();
        LiveAudioStream.removeAllListeners();
        this.stopAudio();

        if (this.session) {
            try { this.session.close(); } catch { }
        }
        this.session = null;
    }

    public disconnect() {
        this.cleanup();
    }
}