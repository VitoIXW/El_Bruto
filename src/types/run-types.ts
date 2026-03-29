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
  | 'cancelled'
  | 'error';

export type ExecutionMode = 'single' | 'all-brutes';
export type RunStyle = 'automatic' | 'interactive';
export type LevelUpBehavior = 'skip_brute' | 'wait_for_manual_resume';
export type InteractiveCompletionBehavior = 'close_program' | 'keep_browser_open';
export type ManualResumeAction = 'continue' | 'cancel';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
export type RunEventType =
  | 'app_ready'
  | 'account_login_started'
  | 'account_login_failed'
  | 'account_login_succeeded'
  | 'brutes_loaded'
  | 'run_started'
  | 'brute_started'
  | 'brute_updated'
  | 'state_changed'
  | 'fight_completed'
  | 'latest_fight_result_detected'
  | 'level_up_detected'
  | 'manual_pause_started'
  | 'manual_pause_resumed'
  | 'run_cancel_requested'
  | 'run_finished'
  | 'log'
  | 'error';
export type RunSelectionMode = 'single' | 'selected' | 'all-brutes';

export interface CliOptions {
  runStyle: RunStyle;
  url?: string;
  mode: ExecutionMode;
  brute?: string;
  account?: string;
  debug: boolean;
  headless: boolean;
  preClickDelay: boolean;
  profileDir?: string;
  artifactsDir?: string;
  logsDir?: string;
  loginTimeoutMs?: number;
}

export interface RunConfig {
  targetUrl: string;
  targetBruteName?: string;
  accountLabel?: string;
  bootstrapUrl: string;
  executionMode: ExecutionMode;
  profileDir: string;
  artifactsDir: string;
  logsDir: string;
  browserExecutablePath?: string;
  headless: boolean;
  debug: boolean;
  preClickDelay: boolean;
  loginTimeoutMs: number;
  stepTimeoutMs: number;
  maxActionRetries: number;
  interactiveLevelUpBehavior?: LevelUpBehavior;
  interactiveCompletionBehavior?: InteractiveCompletionBehavior;
  onInteractiveLevelUpReady?: (bruteName: string) => Promise<ManualResumeAction>;
  loginCredentials?: LoginCredentials;
  stopSignal?: AbortSignal;
  onRunEvent?: RunEventSink;
}

export interface LoginCredentials {
  username: string;
  password: string;
  source: 'environment' | 'saved-account' | 'interactive';
}

export interface SavedAccount {
  label: string;
  username: string;
  password: string;
}

export interface AccountDescriptor {
  label: string;
  username: string;
}

export interface DesktopPreferences {
  lastAccountLabel?: string;
  runMode: RunSelectionMode;
  levelUpBehavior: LevelUpBehavior;
  completionBehavior: InteractiveCompletionBehavior;
  preClickDelayEnabled: boolean;
  maxPreClickDelaySeconds: number;
  showDetailedLogs: boolean;
}

export interface RunSelection {
  mode: RunSelectionMode;
  bruteNames: string[];
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  line: string;
}

export interface RunEvent<TPayload = unknown> {
  type: RunEventType;
  timestamp: string;
  payload?: TPayload;
}

export type RunEventSink = (event: RunEvent<unknown>) => void;

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
  wins: number;
  losses: number;
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
  totalWins: number;
  totalLosses: number;
  restingCount: number;
  manualInterventionCount: number;
  errorCount: number;
  brutes: RunSummary[];
}

export interface AggregatedRunMetrics {
  totalBrutesProcessed: number;
  totalFightsCompleted: number;
  totalWins: number;
  totalLosses: number;
  restingCount: number;
  manualInterventionCount: number;
  errorCount: number;
  cancelledCount: number;
}

export interface ManagedRunResult {
  selection: RunSelection;
  summaries: RunSummary[];
  accountSummary?: AccountRunSummary;
  metrics: AggregatedRunMetrics;
  cycleCompleted?: boolean;
  advanceFailed?: boolean;
  failureReason?: string;
}
