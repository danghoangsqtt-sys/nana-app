import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { UserSettings, EyeState, Emotion, UserLocation, AppMode } from "../types";
import { wrapPcmWithWav } from "../utils/audioUtils";

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
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
        });

        const config: any = {
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                // Enable transcriptions for both User input and Model output
                inputAudioTranscription: { model: "google-1.0-pro-en" }, 
                outputAudioTranscription: { model: "google-1.0-pro-en" },
                systemInstruction: settings.systemInstruction || "You are NaNa, a helpful AI assistant. Answer briefly and with personality.",
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
      this.startChunkedRecording();
  }

  private async handleMessage(message: LiveServerMessage) {
      // 1. Handle Transcriptions (Subtitle effect)
      if (message.serverContent?.outputTranscription) {
        const text = message.serverContent.outputTranscription.text;
        this.currentOutputTranscription += text;
        this.onTranscript(this.currentOutputTranscription, false, false);
      } else if (message.serverContent?.inputTranscription) {
        const text = message.serverContent.inputTranscription.text;
        this.currentInputTranscription += text;
        this.onTranscript(this.currentInputTranscription, true, false);
      }

      // Turn Complete: Commit the transcription
      if (message.serverContent?.turnComplete) {
          if (this.currentInputTranscription) {
             this.onTranscript(this.currentInputTranscription, true, true);
             this.currentInputTranscription = '';
          }
          if (this.currentOutputTranscription) {
             this.onTranscript(this.currentOutputTranscription, false, true);
             this.currentOutputTranscription = '';
          }

          if (this.playbackQueue.length === 0 && !this.isPlaying) {
              this.onStateChange(EyeState.LISTENING);
          }
      }

      // 2. Handle Audio Output
      const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
      if (audioData) {
          this.queueAudio(audioData);
          this.onStateChange(EyeState.SPEAKING);
      }
  }

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
      const pcmChunk = this.playbackQueue.shift();
      if (!pcmChunk) return;

      try {
          const wavBase64 = wrapPcmWithWav(pcmChunk, 24000);
          const cacheDir = (FileSystem as any).cacheDirectory;
          const filename = `${cacheDir}temp_audio_${Date.now()}.wav`;
          await FileSystem.writeAsStringAsync(filename, wavBase64, { encoding: 'base64' });

          const { sound } = await Audio.Sound.createAsync({ uri: filename });
          this.currentSound = sound;
          await sound.playAsync();

          sound.setOnPlaybackStatusUpdate(async (status) => {
              if (status.isLoaded && status.didJustFinish) {
                  await sound.unloadAsync();
                  await FileSystem.deleteAsync(filename, { idempotent: true });
                  this.playNextChunk();
              }
          });

      } catch (e) {
          console.error("Playback error", e);
          this.isPlaying = false;
      }
  }

  private async startChunkedRecording() {
      this.isRecording = true;
      
      const recordLoop = async () => {
          if (!this.isRecording) return;
          if (this.isPlaying) {
             // Simple echo cancellation: pause recording while AI speaks
             setTimeout(recordLoop, 300);
             return; 
          }

          try {
              const recording = new Audio.Recording();
              await recording.prepareToRecordAsync(RECORDING_OPTIONS);
              
              recording.setOnRecordingStatusUpdate((status) => {
                 if (status.metering) this.onVolumeChange((status.metering + 160) / 1.6);
              });

              await recording.startAsync();
              this.recording = recording;

              // Record short chunk
              await new Promise(resolve => setTimeout(resolve, 600)); 

              await recording.stopAndUnloadAsync();
              const uri = recording.getURI();
              
              if (uri && this.session) {
                  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                  this.session.sendRealtimeInput({ media: { mimeType: "audio/wav", data: base64 } });
                  await FileSystem.deleteAsync(uri, { idempotent: true });
              }

          } catch (e) {
              console.error("Recording loop error", e);
          }

          if (this.isRecording) {
             recordLoop();
          }
      };

      recordLoop();
  }

  public disconnect() {
      this.isRecording = false;
      this.isPlaying = false;
      if (this.currentSound) {
          this.currentSound.stopAsync();
          this.currentSound.unloadAsync();
      }
      if (this.session) {
          try { this.session.close(); } catch {}
      }
      this.session = null;
      this.currentInputTranscription = '';
      this.currentOutputTranscription = '';
  }
}