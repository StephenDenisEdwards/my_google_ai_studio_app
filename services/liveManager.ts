import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { createPcmBlob, decodeAudioData } from './audioUtils';
import { DetectedIntent, IntentType } from '../types';

// Configuration
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
const API_KEY = process.env.API_KEY as string;

// Helper type for the session object since it is not exported by the SDK
type LiveSession = Awaited<ReturnType<GoogleGenAI['live']['connect']>>;

// Tool Definitions
const reportIntentTool: FunctionDeclaration = {
  name: 'report_intent',
  description: 'Report a detected question or imperative command and provide an answer or acknowledgment.',
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
      },
      answer: {
        type: Type.STRING,
        description: 'A concise, helpful answer to the question, or a confirmation that the command is understood/simulated.'
      }
    },
    required: ['text', 'type', 'answer']
  }
};

export class LiveManager {
  private ai: GoogleGenAI;
  private session: LiveSession | null = null;
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
      // Note: Some browsers might ignore 'sampleRate' in options and use hardware rate
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, 
      });

      // Ensure context is running
      if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume();
      }

      // Get Microphone Stream
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start Gemini Session
      const sessionPromise = this.ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
          },
          inputAudioTranscription: {}, // Enable transcription
          systemInstruction: `
            You are a dedicated Conversation Monitor and Assistant.
            
            1. **Listen**: Monitor the user's audio stream.
            2. **Analyze**: Detect if the user asks a QUESTION or issues an IMPERATIVE COMMAND.
            3. **Respond**: 
               - If a **Question** is detected, formulate a concise, helpful answer.
               - If an **Imperative** is detected, formulate a confirmation or a simulated execution response (e.g., "I have noted that task").
            4. **Report**: IMMEDIATELY call the tool 'report_intent' with:
               - 'text': The user's exact words.
               - 'type': QUESTION or IMPERATIVE.
               - 'answer': Your generated response/answer.
            
            Do not generate spoken audio responses for these interactions; rely solely on the tool to convey the answer.
            If there is silence or casual chatter that is not a question or command, do nothing.
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

      // Wait for session to be ready to avoid race conditions
      this.session = await sessionPromise;
      this.isConnected = true;

    } catch (err) {
      console.error('Connection failed', err);
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
      if (!this.inputAudioContext) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.onVolumeUpdate(rms);

      // Send to Gemini
      // CRITICAL: Use the actual sampleRate of the context, not the requested one.
      // Mismatch between actual and reported sample rates causes server errors.
      const pcmBlob = createPcmBlob(inputData, this.inputAudioContext.sampleRate);
      
      if (this.session) {
        this.session.sendRealtimeInput({ media: pcmBlob });
      }
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
            type: args.type as IntentType,
            answer: args.answer
          });

          // Acknowledge tool execution to keep model happy
          if (this.session) {
            this.session.sendToolResponse({
              functionResponses: [{
                id: fc.id,
                name: fc.name,
                response: { result: 'logged' }
              }]
            });
          }
        }
      }
    }
  }

  private handleClose() {
    console.log('Gemini Live Session Closed');
    this.disconnect();
  }

  private handleError(e: ErrorEvent) {
    console.error('Gemini Live Error', e);
    const msg = (e as any).message || 'Connection error detected';
    this.onError(new Error(msg));
  }

  public disconnect() {
    this.isConnected = false;
    this.session = null;
    
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
    
    this.onDisconnect();
  }
}