import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { UserSettings, EyeState, Emotion, UserLocation, AppMode } from "../types";
import { wrapPcmWithWav } from "../utils/audioUtils";

// Thresholds
const VAD_THRESHOLD_DB = -45; // Amplitude threshold to consider as speech (silence is usually < -60dB)
const CHUNK_DURATION_MS = 600; // Duration of each recording chunk

const RECORDING_OPTIONS: any = {
    android: {
        extension: '.wav',
        outputFormat: Audio.AndroidOutputFormat.DEFAULT,
        audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 256000,
    },
    ios: {
        extension: '.wav',
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRateStrategy: Audio.IOSBitRateStrategy.CONSTANT,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
    },
    web: {}
};

export class LiveService {
    private ai: GoogleGenAI;
    private session: any = null;
    private sessionPromise: Promise<any> | null = null;

    // Audio Playback
    private playbackQueue: string[] = [];
    private isPlaying = false;
    private currentSound: Audio.Sound | null = null;

    // Audio Recording
    private recording: Audio.Recording | null = null;
    private isRecording = false;

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
            // Important: Enable playsInSilentModeIOS and allowsRecordingIOS for Duplex audio (Talk & Listen same time)
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            const config: any = {
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: { model: "google-1.0-pro-en" },
                    outputAudioTranscription: { model: "google-1.0-pro-en" },
                    systemInstruction: settings.systemInstruction || "You are NaNa, a helpful AI assistant. Answer briefly.",
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Zephyr' }
                        }
                    },
                },
                callbacks: {
                    onopen: this.handleOpen.bind(this),
                    onmessage: this.handleMessage.bind(this),
                    onclose: () => {
                        this.onStateChange(EyeState.IDLE);
                        this.onDisconnect();
                    },
                    onerror: (e: any) => this.onError(e.message || "Connection Error"),
                }
            };

            this.sessionPromise = this.ai.live.connect(config);
            this.session = await this.sessionPromise;

        } catch (e: any) {
            this.onError(e.message);
            this.onDisconnect();
        }
    }

    private handleOpen() {
        console.log("Connected to Gemini Live");
        this.onStateChange(EyeState.LISTENING);
        this.startSmartRecording();
    }

    private async handleMessage(message: LiveServerMessage) {
        // 1. Handle Transcriptions
        if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            this.currentOutputTranscription += text;
            this.onTranscript(this.currentOutputTranscription, false, false);
        } else if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            this.currentInputTranscription += text;
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

            // Return to listening state only if queue is empty
            if (this.playbackQueue.length === 0 && !this.isPlaying) {
                this.onStateChange(EyeState.LISTENING);
            }
        }

        // 2. Handle Audio Output
        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
            this.queueAudio(audioData);
        }
    }

    // --- AUDIO OUTPUT (PLAYBACK) ---

    private queueAudio(base64Pcm: string) {
        this.playbackQueue.push(base64Pcm);
        if (!this.isPlaying) {
            this.playNextChunk();
        }
    }

    private async playNextChunk() {
        if (this.playbackQueue.length === 0) {
            this.isPlaying = false;
            this.onStateChange(EyeState.LISTENING);
            return;
        }

        this.isPlaying = true;
        this.onStateChange(EyeState.SPEAKING);

        const pcmChunk = this.playbackQueue.shift();
        if (!pcmChunk) return;

        try {
            const wavBase64 = wrapPcmWithWav(pcmChunk, 24000);
            const cacheDir = (FileSystem as any).cacheDirectory;
            const filename = `${cacheDir}play_${Date.now()}.wav`;

            await FileSystem.writeAsStringAsync(filename, wavBase64, { encoding: 'base64' });

            const { sound } = await Audio.Sound.createAsync({ uri: filename });
            this.currentSound = sound;

            sound.setOnPlaybackStatusUpdate(async (status) => {
                if (status.isLoaded && status.didJustFinish) {
                    await sound.unloadAsync();
                    await FileSystem.deleteAsync(filename, { idempotent: true });
                    this.playNextChunk();
                }
            });

            await sound.playAsync();

        } catch (e) {
            console.error("Playback error", e);
            this.isPlaying = false;
            this.playNextChunk(); // Try next chunk
        }
    }

    /**
     * Immediately stops audio playback and clears queue.
     * Called when VAD detects user speech (Barge-in).
     */
    private async stopAudio() {
        this.isPlaying = false;
        this.playbackQueue = []; // Clear queue

        if (this.currentSound) {
            try {
                await this.currentSound.stopAsync();
                await this.currentSound.unloadAsync();
            } catch (e) {
                // Ignore errors during stop/unload
            }
            this.currentSound = null;
        }
        this.onStateChange(EyeState.LISTENING);
    }

    // --- AUDIO INPUT (SMART RECORDING) ---

    private async startSmartRecording() {
        this.isRecording = true;

        const recordLoop = async () => {
            if (!this.isRecording) return;

            let maxAmplitude = -160; // Initialize with silence (dB)

            try {
                const recording = new Audio.Recording();
                await recording.prepareToRecordAsync({
                    ...RECORDING_OPTIONS,
                    isMeteringEnabled: true // Critical for VAD
                });

                recording.setOnRecordingStatusUpdate((status) => {
                    // Update visual volume
                    if (status.metering !== undefined) {
                        const normalizedVol = (status.metering + 160) / 1.6;
                        this.onVolumeChange(normalizedVol);

                        // Track max volume for VAD
                        if (status.metering > maxAmplitude) {
                            maxAmplitude = status.metering;
                        }
                    }
                });

                await recording.startAsync();
                this.recording = recording;

                // Record for a short chunk
                await new Promise(resolve => setTimeout(resolve, CHUNK_DURATION_MS));

                // Stop recording
                await recording.stopAndUnloadAsync();
                const uri = recording.getURI();

                // --- VAD LOGIC ---
                if (maxAmplitude > VAD_THRESHOLD_DB) {
                    // Voice Detected!

                    // 1. Barge-in Check: If AI is speaking, SHUT IT UP.
                    if (this.isPlaying) {
                        console.log("Barge-in detected! Stopping audio.");
                        await this.stopAudio();
                    }

                    // 2. Send Data
                    if (uri && this.session) {
                        // Only read file IO if VAD passed
                        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                        this.session.sendRealtimeInput({ media: { mimeType: "audio/wav", data: base64 } });
                    }
                } else {
                    // Silence detected. Do nothing. Saves Bandwidth & Processing.
                }

                // Cleanup file
                if (uri) {
                    await FileSystem.deleteAsync(uri, { idempotent: true });
                }

            } catch (e) {
                console.error("Recording loop error", e);
                // Prevent fast loop crashing on error
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Continue loop
            if (this.isRecording) {
                recordLoop();
            }
        };

        recordLoop();
    }

    public disconnect() {
        this.isRecording = false;
        this.stopAudio(); // Ensure playback stops

        if (this.session) {
            try { this.session.close(); } catch { }
        }
        this.session = null;
        this.currentInputTranscription = '';
        this.currentOutputTranscription = '';
    }
}