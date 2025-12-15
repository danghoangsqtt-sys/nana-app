
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration, Tool } from "@google/genai";
import { Audio } from 'expo-av';
import LiveAudioStream from 'react-native-live-audio-stream';
import { UserSettings, EyeState, UserLocation, AppMode, VideoCommand } from "../types";
import { wrapPcmWithWav, atob } from "../utils/audioUtils";

// Audio Config
const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BIT_DEPTH = 16;
const BUFFER_SIZE = 4096;

// --- TOOL DEFINITIONS ---
const toolsDef: Tool[] = [
    {
        functionDeclarations: [
            {
                name: "play_youtube_video",
                description: "Play a specific video from YouTube. Use this when the user asks to watch something or play music.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        url: { type: Type.STRING, description: "The YouTube URL of the video (e.g., https://www.youtube.com/watch?v=...)" },
                        title: { type: Type.STRING, description: "The title of the video" }
                    },
                    required: ["url", "title"]
                }
            },
            {
                name: "set_reminder",
                description: "Set a reminder for a specific task at a specific time.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        task: { type: Type.STRING, description: "The task to remind about" },
                        time: { type: Type.STRING, description: "The time for the reminder (e.g., '10:00 AM')" }
                    },
                    required: ["task", "time"]
                }
            },
            {
                name: "open_settings",
                description: "Open the application settings menu.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {},
                }
            },
            {
                name: "enter_deep_sleep",
                description: "Enter a deep sleep mode where the assistant stops listening and rests.",
                parameters: {
                    type: Type.OBJECT,
                    properties: {},
                }
            }
        ]
    }
];

export class LiveService {
    private ai: GoogleGenAI;
    private connectionPromise: Promise<any> | null = null;
    private streamSubscription: any = null;

    // Audio Playback State
    private isPlaying = false;
    private audioQueue: string[] = [];
    private currentSound: Audio.Sound | null = null;
    private nextSound: Audio.Sound | null = null;
    private voiceSensitivity: number = 1.5;

    // Callbacks
    public onStateChange: (state: EyeState) => void = () => { };
    public onTranscript: (text: string, isUser: boolean, isFinal: boolean) => void = () => { };
    public onError: (message: string) => void = () => { };
    public onDisconnect: () => void = () => { };
    public onVolumeChange: (volume: number) => void = () => { };

    // Tool Callbacks
    public onVideoCommand: (command: VideoCommand) => void = () => { };
    public onSettingsCommand: () => void = () => { };
    public onSleepCommand: () => void = () => { };

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
            const options = {
                sampleRate: SAMPLE_RATE,
                channels: CHANNELS,
                bitsPerSample: BIT_DEPTH,
                audioSource: 1,
                bufferSize: BUFFER_SIZE,
                wavFile: 'temp.wav'
            };
            LiveAudioStream.init(options);

            // 3. Determine System Instruction
            let systemInstruction = settings.systemInstruction || "You are NaNa, a helpful AI.";

            if (mode === 'translator') {
                const langA = settings.translationLangA || 'English';
                const langB = settings.translationLangB || 'Spanish';
                systemInstruction = `You are a professional, real-time bi-directional interpreter between ${langA} and ${langB}. Translate spoken audio instantly. Do not chat.`;
            }

            // 4. Configure Gemini Live Session with Tools
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
                    tools: mode === 'assistant' ? toolsDef : [], // Only use tools in assistant mode
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
            const length = raw.length;
            for (let i = 0; i < length; i += 4) {
                const char = raw.charCodeAt(i);
                sum += char * char;
            }
            const rms = Math.sqrt(sum / (length / 4));
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

        // 2. Turn Complete
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

        // 3. Interruption Handling
        if (message.serverContent?.interrupted) {
            console.log("Interruption detected");
            await this.stopAudio();
            this.audioQueue = [];
            this.onStateChange(EyeState.LISTENING);
            return;
        }

        // 4. Handle Tool Calls (Function Calling)
        if (message.toolCall) {
            this.handleToolCall(message.toolCall);
        }

        // 5. Process Audio Output
        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
            this.queueAudio(audioData);
        }
    }

    private handleToolCall(toolCall: any) {
        console.log("Tool Call Received:", toolCall);
        const responses = [];

        for (const fc of toolCall.functionCalls) {
            let result: any = { result: "ok" };

            switch (fc.name) {
                case "play_youtube_video":
                    if (fc.args.url && fc.args.title) {
                        this.onVideoCommand({ url: fc.args.url as string, title: fc.args.title as string });
                        result = { result: "Video playing on screen" };
                    } else {
                        result = { error: "Missing url or title" };
                    }
                    break;
                case "set_reminder":
                    // Mock success
                    result = { result: `Reminder set for ${fc.args.task} at ${fc.args.time}` };
                    break;
                case "open_settings":
                    this.onSettingsCommand();
                    result = { result: "Settings menu opened" };
                    break;
                case "enter_deep_sleep":
                    this.onSleepCommand();
                    result = { result: "Entering sleep mode. Goodnight." };
                    break;
                default:
                    result = { error: "Unknown function" };
            }

            responses.push({
                id: fc.id,
                name: fc.name,
                response: result
            });
        }

        // Send response back to Gemini
        if (this.connectionPromise) {
            this.connectionPromise.then(session => {
                session.sendToolResponse({ functionResponses: responses });
            });
        }
    }

    // --- AUDIO PLAYBACK ---

    private queueAudio(base64Pcm: string) {
        this.audioQueue.push(base64Pcm);
        if (!this.isPlaying) {
            this.playNextChunk();
        } else {
            this.preloadNext();
        }
    }

    private async preloadNext() {
        if (this.nextSound || this.audioQueue.length === 0) return;
        try {
            const pcm = this.audioQueue[0];
            const wavHeader = wrapPcmWithWav(pcm, 24000);
            const uri = `data:audio/wav;base64,${wavHeader}`;
            const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
            this.nextSound = sound;
        } catch (e) {
            console.warn("Preload error:", e);
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

        let soundToPlay: Audio.Sound | null = null;
        const pcm = this.audioQueue.shift()!;

        try {
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
            this.preloadNext();

            soundToPlay.setOnPlaybackStatusUpdate(async (status) => {
                if (status.isLoaded && status.didJustFinish) {
                    await soundToPlay?.unloadAsync();
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
        try { LiveAudioStream.stop(); } catch { }
        if (this.streamSubscription && typeof this.streamSubscription.remove === 'function') {
            this.streamSubscription.remove();
        }
        this.streamSubscription = null;
        this.stopAudio();
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
