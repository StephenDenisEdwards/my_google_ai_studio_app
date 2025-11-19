import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { createPcmBlob, decodeAudioData } from './audioUtils';
import { DetectedIntent, IntentType } from '../types';

// Configuration
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
const API_KEY = process.env.API_KEY as string;

// Tool Definitions
const reportIntentTool: FunctionDeclaration = {
  name: 'report_intent',
  description: 'Report a detected question or imperative command from the user speech.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: { 
        type: Type.STRING, 
        description: 'The verbatim text of the question or command detected.' 
      },
      type: { 
        type: Type.STRING, 
        enum: ['QUESTION', 'IMPERATIVE'], 
        description: 'The classification of the detected speech.' 
      }
    },
    required: ['text', 'type']
  }
};

export class LiveManager {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isConnected = false;

  // Event Callbacks
  public onTranscriptUpdate: (text: string) => void = () => {};
  public onIntentDetected: (intent: Omit<DetectedIntent, 'id' | 'timestamp'>) => void = () => {};
  public onVolumeUpdate: (volume: number) => void = () => {};
  public onError: (error: Error) => void = () => {};
  public onDisconnect: () => void = () => {};

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  public async connect() {
    if (this.isConnected) return;

    try {
      // Initialize Audio Context
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, // Gemini prefers 16k input
      });

      // Get Microphone Stream
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start Gemini Session
      this.sessionPromise = this.ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, // Enable transcription
          systemInstruction: `
            You are a dedicated Conversation Monitor and Intent Analyzer.
            Your goal is to listen passively to the user's audio stream.
            
            1. **Transcribe**: The system handles this, but you must listen carefully.
            2. **Analyze**: Detect if the user asks a specific QUESTION or issues an IMPERATIVE COMMAND (instruction).
            3. **Report**: If you detect a Question or Command, IMMEDIATELY call the tool 'report_intent' with the exact text and type.
            4. **Silence**: Do not engage in conversation. Do not answer the questions. Do not obey the commands. Merely report them.
            
            If there is silence or casual chatter, do nothing.
          `,
          tools: [{ functionDeclarations: [reportIntentTool] }]
        },
        callbacks: {
          onopen: this.handleOpen.bind(this),
          onmessage: this.handleMessage.bind(this),
          onclose: this.handleClose.bind(this),
          onerror: this.handleError.bind(this),
        }
      });

      this.isConnected = true;

    } catch (err) {
      this.onError(err instanceof Error ? err : new Error('Failed to connect'));
      this.disconnect();
    }
  }

  private handleOpen() {
    console.log('Gemini Live Session Opened');
    if (!this.inputAudioContext || !this.stream) return;

    // Setup Audio Processing
    this.source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.onVolumeUpdate(rms);

      // Send to Gemini
      const pcmBlob = createPcmBlob(inputData);
      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Transcription
    const transcript = message.serverContent?.inputTranscription?.text;
    if (transcript) {
      this.onTranscriptUpdate(transcript);
    }

    // Handle Tool Calls (Intents)
    if (message.toolCall) {
      for (const fc of message.toolCall.functionCalls) {
        if (fc.name === 'report_intent') {
          const args = fc.args as any;
          this.onIntentDetected({
            text: args.text,
            type: args.type as IntentType
          });

          // Acknowledge tool execution to keep model happy
          this.sessionPromise?.then(session => {
            session.sendToolResponse({
              functionResponses: {
                id: fc.id,
                name: fc.name,
                response: { result: 'logged' }
              }
            });
          });
        }
      }
    }

    // We largely ignore audio output here as we are in "monitor" mode.
    // However, we must process it or at least not crash if it arrives.
    // If we wanted to hear the model's "acknowledgments", we would decode and play here.
  }

  private handleClose() {
    console.log('Gemini Live Session Closed');
    this.disconnect();
  }

  private handleError(e: ErrorEvent) {
    console.error('Gemini Live Error', e);
    this.onError(new Error('Connection error detected'));
  }

  public disconnect() {
    this.isConnected = false;
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }

    // Note: session.close() isn't explicitly available on the session object in the current SDK pattern often,
    // but the connection drops when we stop sending and the object goes out of scope or if we had a close method.
    // For now, stopping the audio input effectively stops the interaction flow.
    
    this.onDisconnect();
  }
}