export enum IntentType {
  QUESTION = 'QUESTION',
  IMPERATIVE = 'IMPERATIVE'
}

export interface DetectedIntent {
  id: string;
  text: string;
  type: IntentType;
  timestamp: number;
  answer?: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface AudioVisualizerData {
  volume: number; // 0.0 to 1.0
}