export interface Step {
  label: string;
  directions: string;
  output: Record<string, string>;
}

export interface Config {
  steps: Step[];
}

export interface Progress {
  configPath: string;
  currentStepIndex: number;
  sharedSpace: SharedSpace;
}

export type SharedSpace = Record<string, unknown>;
