import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Audio } from 'expo-av';
import LiveAudioStream from 'react-native-live-audio-stream';
import { UserSettings, EyeState, UserLocation, AppMode } from "../types";
import { wrapPcmWithWav, atob } from "../utils/audioUtils";

// Audio Config
const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BIT_DEPTH = 16;
const BUFFER_SIZE = 4096; // Increased buffer for stability

export class LiveService {
    private ai: GoogleGenAI;
    private connectionPromise: Promise<any> | null = null;
    private streamSubscription: any = null;

    // Audio Playback State
    private isPlaying = false;
    private audioQueue: string[] = [];
    private currentSound: Audio.Sound | null = null;
    private nextSound: Audio.Sound | null = null; // Pre-loaded buffer
    private voiceSensitivity: number = 1.5;

    // Callbacks
    public onStateChange: (state: EyeState) => void = () => { };
    public onTranscript: (text: string, isUser: boolean, isFinal: boolean) => void = () => { };
    public onError: (message: string) => void = () => { };
    public onDisconnect: () => void = () => { };
    public onVolumeChange: (volume: number) => void = () => { };

    // Internal Transcription State
    private currentInputTranscription = '';
    private currentOutputTranscription = '';

    constructor(apiKey: string) {
        this.ai = new GoogleGenAI({ apiKey });
    }

    async connect(settings: UserSettings, location: UserLocation | null, mode: AppMode) {
        try {
            this.voiceSensitivity = settings.voiceSensitivity ?? 1.5;

            // 1. Setup Audio Mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            // 2. Initialize Microphone Stream
            // Changed audioSource from 6 (VOICE_RECOGNITION) to 1 (MIC) for better compatibility
            const options = {
                sampleRate: SAMPLE_RATE,
                channels: CHANNELS,
                bitsPerSample: BIT_DEPTH,
                audioSource: 1,
                bufferSize: BUFFER_SIZE,
                wavFile: 'temp.wav'
            };
            LiveAudioStream.init(options);

            // 3. Determine System Instruction based on Mode
            let systemInstruction = settings.systemInstruction || "You are NaNa, a helpful AI.";

            if (mode === 'translator') {
                const langA = settings.translationLangA || 'English';
                const langB = settings.translationLangB || 'Spanish';
                systemInstruction = `You are a professional, real-time bi-directional interpreter. 
            Your task is to translate spoken audio strictly between ${langA} and ${langB}.
            
            Rules:
            1. If you hear ${langA}, translate it immediately to ${langB}.
            2. If you hear ${langB}, translate it immediately to ${langA}.
            3. Do not answer questions, do not have a conversation, and do not add filler words like "Sure" or "Here is the translation".
            4. Output ONLY the translated spoken audio.`;
            }

            // 4. Configure Gemini Live Session
            const config: any = {
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: systemInstruction,
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                    },
                },
                callbacks: {
                    onopen: this.handleOpen.bind(this),
                    onmessage: this.handleMessage.bind(this),
                    onclose: () => {
                        console.log("Session closed");
                        this.cleanup();
                        this.onDisconnect();
                    },
                    onerror: (e: any) => {
                        console.error("Session error:", e);
                        this.onError(e.message || "Connection Error");
                    },
                }
            };

            // 5. Connect & Store Promise
            this.connectionPromise = this.ai.live.connect(config);

        } catch (e: any) {
            this.onError(e.message);
            this.onDisconnect();
        }
    }

    private handleOpen() {
        console.log("Connected to Gemini Live");
        this.onStateChange(EyeState.LISTENING);

        // Start Streaming Input
        this.streamSubscription = (LiveAudioStream as any).on('data', (data: string) => {
            if (this.connectionPromise) {
                const volume = this.calculateVolume(data);

                // Noise Gate Logic
                // High sensitivity (2.0) -> Low Threshold (0) -> Pass everything
                // Low sensitivity (0.5) -> High Threshold (15) -> Pass only loud sounds
                // Default 1.5 -> Threshold 5
                const threshold = (2.0 - this.voiceSensitivity) * 10;

                if (volume > threshold) {
                    this.connectionPromise.then((session) => {
                        session.sendRealtimeInput({
                            media: {
                                mimeType: "audio/pcm;rate=16000",
                                data: data
                            }
                        });
                    }).catch(e => console.warn("Failed to send audio chunk", e));
                }
            }
        });
        LiveAudioStream.start();
    }

    private calculateVolume(base64: string): number {
        try {
            const raw = atob(base64);
            let sum = 0;
            // Optimization: Sample every 4th byte to reduce CPU load
            const length = raw.length;
            for (let i = 0; i < length; i += 4) {
                const char = raw.charCodeAt(i);
                sum += char * char;
            }
            const rms = Math.sqrt(sum / (length / 4));
            // Normalize 0-100 roughly
            const normalized = Math.min(Math.max(rms / 2, 0), 100);
            this.onVolumeChange(normalized);
            return normalized;
        } catch (e) {
            return 0;
        }
    }

    private async handleMessage(message: LiveServerMessage) {
        // 1. Handle Transcriptions
        if (message.serverContent?.outputTranscription) {
            this.currentOutputTranscription += message.serverContent.outputTranscription.text;
            this.onTranscript(this.currentOutputTranscription, false, false);
        } else if (message.serverContent?.inputTranscription) {
            this.currentInputTranscription += message.serverContent.inputTranscription.text;
            this.onTranscript(this.currentInputTranscription, true, false);
        }

        // 2. Turn Complete (Flush transcripts)
        if (message.serverContent?.turnComplete) {
            if (this.currentInputTranscription) {
                this.onTranscript(this.currentInputTranscription, true, true);
                this.currentInputTranscription = '';
            }
            if (this.currentOutputTranscription) {
                this.onTranscript(this.currentOutputTranscription, false, true);
                this.currentOutputTranscription = '';
            }

            // If no audio is playing and queue is empty, return to listening state
            if (!this.isPlaying && this.audioQueue.length === 0) {
                this.onStateChange(EyeState.LISTENING);
            }
        }

        // 3. Interruption Handling (Server detected user speech)
        if (message.serverContent?.interrupted) {
            console.log("Interruption detected");
            await this.stopAudio();
            this.audioQueue = [];
            this.onStateChange(EyeState.LISTENING);
            return;
        }

        // 4. Process Audio Output
        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
            this.queueAudio(audioData);
        }
    }

    // --- OPTIMIZED AUDIO PLAYBACK ---

    private queueAudio(base64Pcm: string) {
        this.audioQueue.push(base64Pcm);

        // If nothing is playing, start immediately
        if (!this.isPlaying) {
            this.playNextChunk();
        } else {
            // If playing, try to prepare the next one in background
            this.preloadNext();
        }
    }

    private async preloadNext() {
        // Only preload if we don't have a next sound ready and we have data
        if (this.nextSound || this.audioQueue.length === 0) return;

        try {
            const pcm = this.audioQueue[0];
            const wavHeader = wrapPcmWithWav(pcm, 24000);
            const uri = `data:audio/wav;base64,${wavHeader}`;

            // Create but don't play yet
            const { sound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: false }
            );
            this.nextSound = sound;
        } catch (e) {
            console.warn("Preload error:", e);
        }
    }

    private async playNextChunk() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            // Only switch to Listening if we aren't waiting for more thinking data
            // But for now, we assume if queue is empty, we are done speaking
            this.onStateChange(EyeState.LISTENING);
            return;
        }

        this.isPlaying = true;
        this.onStateChange(EyeState.SPEAKING);

        let soundToPlay: Audio.Sound | null = null;
        const pcm = this.audioQueue.shift()!; // Consume data

        try {
            // Strategy: Use preloaded sound OR create new one
            if (this.nextSound) {
                soundToPlay = this.nextSound;
                this.nextSound = null;
            } else {
                const wavHeader = wrapPcmWithWav(pcm, 24000);
                const uri = `data:audio/wav;base64,${wavHeader}`;
                const { sound } = await Audio.Sound.createAsync({ uri });
                soundToPlay = sound;
            }

            this.currentSound = soundToPlay;

            // Start preloading the *next* chunk immediately while this one starts
            this.preloadNext();

            // Setup completion listener
            soundToPlay.setOnPlaybackStatusUpdate(async (status) => {
                if (status.isLoaded && status.didJustFinish) {
                    // Cleanup immediately
                    await soundToPlay?.unloadAsync();
                    this.currentSound = null;
                    // Loop
                    this.playNextChunk();
                }
            });

            await soundToPlay.playAsync();

        } catch (e) {
            console.error("Playback error", e);
            this.isPlaying = false;
            this.playNextChunk(); // Skip bad chunk
        }
    }

    private async stopAudio() {
        this.isPlaying = false;

        if (this.currentSound) {
            try {
                await this.currentSound.stopAsync();
                await this.currentSound.unloadAsync();
            } catch { }
            this.currentSound = null;
        }

        if (this.nextSound) {
            try { await this.nextSound.unloadAsync(); } catch { }
            this.nextSound = null;
        }
    }

    public cleanup() {
        this.onStateChange(EyeState.IDLE);

        try {
            LiveAudioStream.stop();
        } catch { }

        if (this.streamSubscription) {
            // Safe check for remove method
            if (typeof this.streamSubscription.remove === 'function') {
                this.streamSubscription.remove();
            }
            this.streamSubscription = null;
        }

        this.stopAudio();

        // Close session properly
        if (this.connectionPromise) {
            this.connectionPromise.then(session => {
                try { session.close(); } catch { }
            });
            this.connectionPromise = null;
        }
    }

    public disconnect() {
        this.cleanup();
    }
}