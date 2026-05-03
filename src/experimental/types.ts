/**
 * Experimental Features Types
 */

export interface ExperimentalConfig {
  enableCoT: boolean;
  enableSelfImprovement: boolean;
  enableCalendar: boolean;
  enableVoice: boolean;
  enableMultiModal: boolean;
  maxCoTDepth: number;
  learningRate: number;
}

export interface CoTResult {
  steps: CoTStep[];
  conclusion: string;
  explanation: string;
  confidence: number;
}

export interface CoTStep {
  step: number;
  thought: string;
  reasoning: string;
}

export interface SelfImprovementEntry {
  id: string;
  feedback: string;
  type: 'positive' | 'negative';
  timestamp: number;
  context: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

export interface VoiceResult {
  audioUrl: string;
  duration: number;
  format: string;
}

export interface MultiModalInput {
  text: string;
  image?: string;
  audio?: string;
}

export interface MultiModalResult {
  response: string;
  confidence: number;
  modalities: string[];
}
