import type {
  AccountDescriptor,
  AggregatedRunMetrics,
  DesktopPreferences,
  LogEntry,
  ManagedRunResult,
  PageState,
  RunEvent,
  RunSummary,
} from '../../types/run-types';

export interface DesktopAccountForm {
  label: string;
  username: string;
  password: string;
  saveAccount: boolean;
}

export interface DesktopLoginRequest {
  accountLabel?: string;
  form?: DesktopAccountForm;
}

export interface DesktopRunOptions {
  mode: 'single' | 'selected' | 'all-brutes';
  bruteNames: string[];
  preferences: DesktopPreferences;
}

export interface DesktopRunStatus {
  isRunning: boolean;
  isPaused: boolean;
  currentBruteName?: string;
  currentState?: PageState;
  startedAt?: string;
  logs: LogEntry[];
  summaries: RunSummary[];
  metrics: AggregatedRunMetrics;
  lastResult?: ManagedRunResult;
}

export interface DesktopSnapshot {
  appName: string;
  accounts: AccountDescriptor[];
  currentAccount?: AccountDescriptor;
  bruteNames: string[];
  preferences: DesktopPreferences;
  sessionReady: boolean;
  run: DesktopRunStatus;
}

export interface DesktopLoginResponse {
  account: AccountDescriptor;
  bruteNames: string[];
  preferences: DesktopPreferences;
  snapshot: DesktopSnapshot;
}

export interface DesktopAccountUpdateRequest {
  previousLabel: string;
  form: Omit<DesktopAccountForm, 'saveAccount'>;
}

export interface DesktopApi {
  accounts: {
    list(): Promise<AccountDescriptor[]>;
    update(request: DesktopAccountUpdateRequest): Promise<AccountDescriptor[]>;
    delete(label: string): Promise<AccountDescriptor[]>;
  };
  auth: {
    login(request: DesktopLoginRequest): Promise<DesktopLoginResponse>;
  };
  run: {
    start(options: DesktopRunOptions): Promise<DesktopSnapshot>;
    cancel(): Promise<DesktopSnapshot>;
    continueAfterLevelUp(): Promise<DesktopSnapshot>;
    status(): Promise<DesktopSnapshot>;
  };
  preferences: {
    load(): Promise<DesktopPreferences>;
    save(preferences: DesktopPreferences): Promise<DesktopPreferences>;
  };
  system: {
    openLogsFolder(): Promise<void>;
    openArtifactsFolder(): Promise<void>;
  };
  onRunEvent(listener: (event: RunEvent<unknown>) => void): () => void;
}

