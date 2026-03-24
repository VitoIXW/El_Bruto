export type PageState =
  | 'cell_ready'
  | 'cell_resting'
  | 'arena_selection'
  | 'pre_fight'
  | 'fight'
  | 'level_up'
  | 'login_required'
  | 'unknown';

export type FinalStatus =
  | 'resting'
  | 'manual_intervention_required'
  | 'login_timeout'
  | 'stabilization_timeout'
  | 'error';

export interface CliOptions {
  url: string;
  debug: boolean;
  profileDir?: string;
  artifactsDir?: string;
  logsDir?: string;
  loginTimeoutMs?: number;
}

export interface RunConfig {
  targetUrl: string;
  bootstrapUrl: string;
  profileDir: string;
  artifactsDir: string;
  logsDir: string;
  headless: false;
  debug: boolean;
  loginTimeoutMs: number;
  stepTimeoutMs: number;
  maxActionRetries: number;
}

export interface StateDetectionDetails {
  state: PageState;
  url: string;
  bruteNameFromPage?: string;
  notes: string[];
}

export interface FailureArtifacts {
  screenshotPath?: string;
  htmlPath?: string;
}

export interface RunSummary {
  bruteName: string;
  fightsCompleted: number;
  finalStatus: FinalStatus;
  restingReached: boolean;
  levelUpDetected: boolean;
  errorsOccurred: boolean;
  artifacts?: FailureArtifacts;
}
