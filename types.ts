export enum OptimizationFramework {
  COSTAR = 'CO-STAR (Context, Objective, Style, Tone, Audience, Response)',
  CLEAR = 'CLEAR (Concise, Logical, Explicit, Adaptive, Reflective)',
  Visual = 'VISUAL (Visuals, Illumination, Subject, Usage, Angles, Lenses)',
  Historical = 'HISTORICAL (Period, Authenticity, Wares, Ethnography, Setting)',
}

export enum Tone {
  Professional = 'Professional',
  Creative = 'Creative',
  Cinematic = 'Cinematic',
  HyperReal = 'Hyper-Realistic',
  Whimsical = 'Whimsical',
  Authentic = 'Historically Authentic',
}

export enum PromptMode {
  Text = 'Text / Chat',
  Image = 'Image Generation',
  Video = 'Video Generation',
}

export interface PromptConfig {
  mode: PromptMode;
  framework: OptimizationFramework;
  tone: Tone;
  includeVariables: boolean;
  negativeConstraint?: string;
  aspectRatio?: string; // e.g. "16:9", "9:16"
}

export interface HistoryItem {
  id: string;
  original: string;
  optimized: string;
  timestamp: number;
}