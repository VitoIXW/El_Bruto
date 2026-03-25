export type PageState =
  | 'public_home'
  | 'login_form'
  | 'authenticated_home'
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

export type ExecutionMode = 'single' | 'all-brutes';
export type RunStyle = 'automatic' | 'interactive';

export interface CliOptions {
  runStyle: RunStyle;
  url?: string;
  mode: ExecutionMode;
  brute?: string;
  debug: boolean;
  headless: boolean;
  profileDir?: string;
  artifactsDir?: string;
  logsDir?: string;
  loginTimeoutMs?: number;
}

export interface RunConfig {
  targetUrl: string;
  targetBruteName?: string;
  bootstrapUrl: string;
  executionMode: ExecutionMode;
  profileDir: string;
  artifactsDir: string;
  logsDir: string;
  headless: boolean;
  debug: boolean;
  loginTimeoutMs: number;
  stepTimeoutMs: number;
  maxActionRetries: number;
  loginCredentials?: LoginCredentials;
}

export interface LoginCredentials {
  username: string;
  password: string;
  source: 'environment' | 'file' | 'saved-account' | 'interactive';
}

export interface SavedAccount {
  label: string;
  username: string;
  password: string;
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

export interface AccountRunSummary {
  mode: 'all-brutes';
  startedBruteName: string;
  cycleCompleted: boolean;
  advanceFailed: boolean;
  failureReason?: string;
  totalBrutesProcessed: number;
  totalFightsCompleted: number;
  restingCount: number;
  manualInterventionCount: number;
  errorCount: number;
  brutes: RunSummary[];
}
