import fs from 'node:fs';
import path from 'node:path';

import type { BrowserWindow } from 'electron';
import { shell } from 'electron';

import { launchPersistentSession, type BrowserSession } from '../../browser/session';
import { authenticateAndDiscoverBrutes, executeRunSelection } from '../../core/run-session';
import { setPreClickDelayEnabled } from '../../game/navigation';
import { createLogger, type Logger } from '../../reporting/logger';
import type {
  AccountDescriptor,
  AggregatedRunMetrics,
  DesktopPreferences,
  LogEntry,
  LoginCredentials,
  ManagedRunResult,
  RunConfig,
  RunEvent,
  RunSummary,
} from '../../types/run-types';
import type {
  DesktopAccountForm,
  DesktopLoginRequest,
  DesktopLoginResponse,
  DesktopRunOptions,
  DesktopSnapshot,
  DesktopRunStatus,
} from '../shared/contracts';
import { DesktopAccountStore } from './account-store';
import type { DesktopAppPaths } from './app-paths';
import { createDefaultDesktopPreferences, DesktopPreferencesStore } from './preferences-store';

const APP_NAME = 'El Bruto Control';
const DEFAULT_BOOTSTRAP_URL = 'https://brute.eternaltwin.org/';
const DEFAULT_LOGIN_TIMEOUT_MS = 180000;
const DEFAULT_STEP_TIMEOUT_MS = 15000;
const DEFAULT_MAX_ACTION_RETRIES = 2;

function buildEmptyMetrics(): AggregatedRunMetrics {
  return {
    totalBrutesProcessed: 0,
    totalFightsCompleted: 0,
    totalWins: 0,
    totalLosses: 0,
    restingCount: 0,
    manualInterventionCount: 0,
    errorCount: 0,
    cancelledCount: 0,
  };
}

function buildEmptyRunStatus(): DesktopRunStatus {
  return {
    isRunning: false,
    isPaused: false,
    logs: [],
    summaries: [],
    metrics: buildEmptyMetrics(),
  };
}

export class DesktopRuntimeController {
  private readonly accountStore: DesktopAccountStore;

  private readonly preferencesStore: DesktopPreferencesStore;

  private readonly logger: Logger;

  private browserSession?: BrowserSession;

  private currentCredentials?: LoginCredentials;

  private currentAccount?: AccountDescriptor;

  private bruteNames: string[] = [];

  private runStatus: DesktopRunStatus = buildEmptyRunStatus();

  private preferences: DesktopPreferences;

  private abortController?: AbortController;

  private pendingManualResume?: {
    bruteName: string;
    resolve: (action: 'continue' | 'cancel') => void;
  };

  private mainWindow?: BrowserWindow;

  constructor(private readonly paths: DesktopAppPaths) {
    this.accountStore = new DesktopAccountStore(paths.accountsFile);
    this.preferencesStore = new DesktopPreferencesStore(paths.preferencesFile);
    this.preferences = this.preferencesStore.load();
    this.logger = createLogger(paths.logsDir, true, (entry) => {
      this.handleLogEntry(entry);
    });
  }

  attachWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    this.emitRunEvent('app_ready', {
      appName: APP_NAME,
      accounts: this.listAccounts(),
    });
  }

  listAccounts(): AccountDescriptor[] {
    return this.accountStore.list();
  }

  loadPreferences(): DesktopPreferences {
    this.preferences = this.preferencesStore.load();
    return this.preferences;
  }

  savePreferences(preferences: DesktopPreferences): DesktopPreferences {
    this.preferences = this.preferencesStore.save(preferences);
    return this.preferences;
  }

  getSnapshot(): DesktopSnapshot {
    return {
      appName: APP_NAME,
      accounts: this.listAccounts(),
      currentAccount: this.currentAccount,
      bruteNames: [...this.bruteNames],
      preferences: this.preferences,
      sessionReady: Boolean(this.browserSession),
      run: {
        ...this.runStatus,
        logs: [...this.runStatus.logs],
        summaries: [...this.runStatus.summaries],
      },
    };
  }

  async login(request: DesktopLoginRequest): Promise<DesktopLoginResponse> {
    const credentials = this.resolveLoginCredentials(request);
    await this.closeBrowserSession();
    this.currentCredentials = credentials;
    this.currentAccount = {
      label: request.form?.label ?? request.accountLabel ?? credentials.username,
      username: credentials.username,
    };
    this.bruteNames = [];
    this.resetRunStatus();

    try {
      this.emitRunEvent('account_login_started', { accountLabel: this.currentAccount.label });
      const config = this.createRunConfig(credentials, this.currentAccount.label);
      const browserSession = await launchPersistentSession(config);
      this.browserSession = browserSession;
      const { bruteNames } = await authenticateAndDiscoverBrutes(browserSession.page, config, this.logger);
      this.bruteNames = bruteNames;
      this.emitRunEvent('account_login_succeeded', {
        accountLabel: this.currentAccount.label,
        bruteNames,
      });

      if (request.form?.saveAccount) {
        this.accountStore.save({
          label: this.currentAccount.label,
          username: credentials.username,
          password: credentials.password,
        });
      }

      this.preferences = this.preferencesStore.save({
        ...this.preferences,
        lastAccountLabel: this.currentAccount.label,
      });

      return {
        account: this.currentAccount,
        bruteNames: [...this.bruteNames],
        preferences: this.preferences,
        snapshot: this.getSnapshot(),
      };
    } catch (error) {
      this.emitRunEvent('account_login_failed', {
        accountLabel: this.currentAccount.label,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.closeBrowserSession();
      this.currentAccount = undefined;
      this.currentCredentials = undefined;
      throw error;
    }
  }

  async updateAccount(previousLabel: string, form: Omit<DesktopAccountForm, 'saveAccount'>): Promise<AccountDescriptor[]> {
    const existingAccount = this.accountStore.load(previousLabel);
    if (!existingAccount) {
      throw new Error(`Saved account "${previousLabel}" was not found.`);
    }

    const nextPassword = form.password.trim() ? form.password : existingAccount.password;
    const credentials: LoginCredentials = {
      username: form.username,
      password: nextPassword,
      source: 'interactive',
    };

    await this.verifyCredentials(form.label, credentials);
    const accounts = this.accountStore.update(previousLabel, {
      label: form.label,
      username: form.username,
      password: nextPassword,
    });

    if (this.currentAccount?.label === previousLabel) {
      this.currentAccount = {
        label: form.label,
        username: form.username,
      };
      this.currentCredentials = credentials;
    }

    return accounts;
  }

  deleteAccount(label: string): AccountDescriptor[] {
    if (this.currentAccount?.label === label) {
      this.currentAccount = undefined;
      this.currentCredentials = undefined;
      this.bruteNames = [];
    }

    return this.accountStore.delete(label);
  }

  async startRun(options: DesktopRunOptions): Promise<DesktopSnapshot> {
    if (!this.currentCredentials || !this.currentAccount) {
      throw new Error('You need to log in before starting a run.');
    }
    if (this.runStatus.isRunning) {
      throw new Error('A run is already in progress.');
    }

    this.preferences = this.preferencesStore.save({
      ...options.preferences,
      lastAccountLabel: this.currentAccount.label,
    });
    setPreClickDelayEnabled(this.preferences.preClickDelayEnabled);

    if (!this.browserSession) {
      await this.login({
        form: {
          label: this.currentAccount.label,
          username: this.currentCredentials.username,
          password: this.currentCredentials.password,
          saveAccount: false,
        },
      });
    }

    this.abortController = new AbortController();
    this.runStatus = {
      isRunning: true,
      isPaused: false,
      currentBruteName: undefined,
      currentState: undefined,
      startedAt: new Date().toISOString(),
      logs: [],
      summaries: [],
      metrics: buildEmptyMetrics(),
    };

    const config = this.createRunConfig(this.currentCredentials, this.currentAccount.label, {
      stopSignal: this.abortController.signal,
      preClickDelay: this.preferences.preClickDelayEnabled,
      onInteractiveLevelUpReady:
        this.preferences.levelUpBehavior === 'wait_for_manual_resume'
          ? async (bruteName: string) =>
            new Promise<'continue' | 'cancel'>((resolve) => {
              this.runStatus.isPaused = true;
              this.pendingManualResume = {
                bruteName,
                resolve,
              };
              this.emitRunEvent('manual_pause_started', { bruteName });
            })
          : undefined,
      onRunEvent: (event) => {
        this.handleRunEvent(event);
      },
    });

    const selection = {
      mode: options.mode,
      bruteNames: options.mode === 'all-brutes' ? [...this.bruteNames] : [...options.bruteNames],
    } as const;

    if (selection.mode !== 'all-brutes' && selection.bruteNames.length === 0) {
      throw new Error('Select at least one brute before starting the run.');
    }

    void this.executeRunInBackground(config, selection);
    return this.getSnapshot();
  }

  async cancelRun(): Promise<DesktopSnapshot> {
    this.abortController?.abort();

    if (this.pendingManualResume) {
      this.pendingManualResume.resolve('cancel');
      this.pendingManualResume = undefined;
    }

    this.runStatus.isRunning = false;
    this.runStatus.isPaused = false;
    await this.shutdown(true);
    return this.getSnapshot();
  }

  async continueAfterLevelUp(): Promise<DesktopSnapshot> {
    if (!this.pendingManualResume) {
      return this.getSnapshot();
    }

    const { bruteName, resolve } = this.pendingManualResume;
    this.pendingManualResume = undefined;
    this.runStatus.isPaused = false;
    resolve('continue');
    this.emitRunEvent('manual_pause_resumed', { bruteName });
    return this.getSnapshot();
  }

  async openLogsFolder(): Promise<void> {
    await shell.openPath(this.paths.logsDir);
  }

  async openArtifactsFolder(): Promise<void> {
    await shell.openPath(this.paths.artifactsDir);
  }

  async shutdown(forceCloseBrowser = false): Promise<void> {
    this.abortController?.abort();
    if (this.pendingManualResume) {
      this.pendingManualResume.resolve('cancel');
      this.pendingManualResume = undefined;
    }

    if (forceCloseBrowser || this.runStatus.isRunning || this.runStatus.isPaused) {
      await this.closeBrowserSession();
    }
  }

  private async executeRunInBackground(
    config: RunConfig,
    selection: { mode: 'single' | 'selected' | 'all-brutes'; bruteNames: string[] },
  ): Promise<void> {
    try {
      const result = await executeRunSelection(this.browserSession!.page, config, this.logger, selection);
      this.runStatus.isRunning = false;
      this.runStatus.isPaused = false;
      this.runStatus.lastResult = result;
      this.runStatus.summaries = [...result.summaries];
      this.runStatus.metrics = result.metrics;

      if (this.preferences.completionBehavior === 'close_program') {
        await this.closeBrowserSession();
      }
    } catch (error) {
      this.runStatus.isRunning = false;
      this.runStatus.isPaused = false;
      this.emitRunEvent('error', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.abortController = undefined;
      this.pendingManualResume = undefined;
    }
  }

  private resetRunStatus(): void {
    this.runStatus = buildEmptyRunStatus();
  }

  private emitRunEvent(eventType: RunEvent['type'], payload?: unknown): void {
    const event: RunEvent<unknown> = {
      type: eventType,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.mainWindow?.webContents.send('run:event', event);
  }

  private handleLogEntry(entry: LogEntry): void {
    this.runStatus.logs = [...this.runStatus.logs.slice(-499), entry];
    this.mainWindow?.webContents.send('run:event', {
      type: 'log',
      timestamp: entry.timestamp,
      payload: entry,
    } satisfies RunEvent<unknown>);
  }

  private handleRunEvent(event: RunEvent<unknown>): void {
    if (event.type === 'state_changed' && this.isRecord(event.payload)) {
      this.runStatus.currentBruteName = typeof event.payload.bruteName === 'string'
        ? event.payload.bruteName
        : this.runStatus.currentBruteName;
      this.runStatus.currentState = typeof event.payload.state === 'string'
        ? event.payload.state as DesktopRunStatus['currentState']
        : this.runStatus.currentState;
    }

    if (event.type === 'brute_updated') {
      const summary = event.payload as RunSummary;
      this.runStatus.summaries = [
        ...this.runStatus.summaries.filter((item) => item.bruteName !== summary.bruteName),
        summary,
      ].sort((left, right) => left.bruteName.localeCompare(right.bruteName));
      this.runStatus.metrics = this.buildMetricsFromSummaries(this.runStatus.summaries);
    }

    if (event.type === 'run_finished') {
      const result = event.payload as ManagedRunResult;
      this.runStatus.lastResult = result;
      this.runStatus.summaries = [...result.summaries];
      this.runStatus.metrics = result.metrics;
      this.runStatus.isRunning = false;
      this.runStatus.isPaused = false;
    }

    if (event.type === 'run_cancel_requested') {
      this.runStatus.isRunning = false;
      this.runStatus.isPaused = false;
    }

    this.mainWindow?.webContents.send('run:event', event);
  }

  private createRunConfig(
    credentials: LoginCredentials,
    accountLabel: string,
    overrides: Partial<RunConfig> = {},
  ): RunConfig {
    return {
      targetUrl: DEFAULT_BOOTSTRAP_URL,
      bootstrapUrl: DEFAULT_BOOTSTRAP_URL,
      executionMode: 'single',
      accountLabel,
      profileDir: this.paths.profileDir,
      artifactsDir: this.paths.artifactsDir,
      logsDir: this.paths.logsDir,
      browserExecutablePath: this.resolveBundledBrowserExecutablePath(),
      headless: false,
      debug: true,
      preClickDelay: this.preferences.preClickDelayEnabled,
      loginTimeoutMs: DEFAULT_LOGIN_TIMEOUT_MS,
      stepTimeoutMs: DEFAULT_STEP_TIMEOUT_MS,
      maxActionRetries: DEFAULT_MAX_ACTION_RETRIES,
      interactiveLevelUpBehavior: this.preferences.levelUpBehavior,
      interactiveCompletionBehavior: this.preferences.completionBehavior,
      loginCredentials: credentials,
      ...overrides,
    };
  }

  private resolveLoginCredentials(request: DesktopLoginRequest): LoginCredentials {
    if (request.accountLabel) {
      const savedAccount = this.accountStore.load(request.accountLabel);
      if (!savedAccount) {
        throw new Error(`Saved account "${request.accountLabel}" was not found.`);
      }

      return {
        username: savedAccount.username,
        password: savedAccount.password,
        source: 'saved-account',
      };
    }

    if (!request.form) {
      throw new Error('No account credentials were provided.');
    }

    return {
      username: request.form.username.trim(),
      password: request.form.password,
      source: 'interactive',
    };
  }

  private async verifyCredentials(label: string, credentials: LoginCredentials): Promise<void> {
    const config = this.createRunConfig(credentials, label);
    const session = await launchPersistentSession(config);
    try {
      await authenticateAndDiscoverBrutes(session.page, config, this.logger);
    } finally {
      await session.context.close();
      fs.rmSync(config.profileDir, { recursive: true, force: true });
    }
  }

  private async closeBrowserSession(): Promise<void> {
    if (!this.browserSession) {
      return;
    }

    const currentSession = this.browserSession;
    this.browserSession = undefined;
    await currentSession.context.close();
  }

  private resolveBundledBrowserExecutablePath(): string | undefined {
    const explicitPath = process.env.BRUTE_CONTROL_CHROMIUM_PATH;
    if (explicitPath) {
      return explicitPath;
    }

    const resourcesCandidate = path.join(process.resourcesPath, 'chromium', process.platform === 'win32' ? 'chrome.exe' : 'chrome');
    if (fs.existsSync(resourcesCandidate)) {
      return resourcesCandidate;
    }

    return undefined;
  }

  private buildMetricsFromSummaries(summaries: RunSummary[]): AggregatedRunMetrics {
    return {
      totalBrutesProcessed: summaries.length,
      totalFightsCompleted: summaries.reduce((total, brute) => total + brute.fightsCompleted, 0),
      totalWins: summaries.reduce((total, brute) => total + brute.wins, 0),
      totalLosses: summaries.reduce((total, brute) => total + brute.losses, 0),
      restingCount: summaries.filter((brute) => brute.restingReached).length,
      manualInterventionCount: summaries.filter((brute) => brute.finalStatus === 'manual_intervention_required').length,
      errorCount: summaries.filter((brute) => brute.errorsOccurred).length,
      cancelledCount: summaries.filter((brute) => brute.finalStatus === 'cancelled').length,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
