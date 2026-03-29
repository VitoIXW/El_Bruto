import React, { useEffect, useMemo, useState } from 'react';

import type { AccountDescriptor, DesktopPreferences, PageState, RunSummary } from '../../types/run-types';
import type {
  DesktopAccountForm,
  DesktopLoginResponse,
  DesktopRunOptions,
  DesktopSnapshot,
} from '../shared/contracts';

type Screen = 'splash' | 'accounts' | 'dashboard';
type AccountMode = 'saved' | 'new';

function createDefaultPreferences(): DesktopPreferences {
  return {
    runMode: 'all-brutes',
    levelUpBehavior: 'skip_brute',
    completionBehavior: 'close_program',
    preClickDelayEnabled: true,
    maxPreClickDelaySeconds: 1.2,
    showDetailedLogs: false,
  };
}

function createEmptySnapshot(): DesktopSnapshot {
  return {
    appName: 'El Bruto Control',
    accounts: [],
    bruteNames: [],
    preferences: createDefaultPreferences(),
    sessionReady: false,
    run: {
      isRunning: false,
      isPaused: false,
      logs: [],
      summaries: [],
      metrics: {
        totalBrutesProcessed: 0,
        totalFightsCompleted: 0,
        totalWins: 0,
        totalLosses: 0,
        restingCount: 0,
        manualInterventionCount: 0,
        errorCount: 0,
        cancelledCount: 0,
      },
    },
  };
}

function createEmptyAccountForm(): DesktopAccountForm {
  return {
    label: '',
    username: '',
    password: '',
    saveAccount: true,
  };
}

function percent(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) {
    return 'n/a';
  }

  return `${((wins / total) * 100).toFixed(1)}%`;
}

function friendlyState(state?: PageState): string {
  if (!state) {
    return 'Idle';
  }

  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function durationSince(startedAt?: string): string {
  if (!startedAt) {
    return '--';
  }

  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function Modal(
  { title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void },
): React.ReactElement {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="ghost-button" onClick={onClose}>Cerrar</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }): React.ReactElement {
  return (
    <div className="summary-card">
      <span className="summary-label">{label}</span>
      <strong className="summary-value">{value}</strong>
    </div>
  );
}

function BruteSummaryCard({ summary }: { summary: RunSummary }): React.ReactElement {
  return (
    <article className="brute-summary-card">
      <div className="brute-summary-header">
        <strong>{summary.bruteName}</strong>
        <span>{summary.finalStatus}</span>
      </div>
      <div className="brute-summary-grid">
        <span>Fights: {summary.fightsCompleted}</span>
        <span>Wins: {summary.wins}</span>
        <span>Losses: {summary.losses}</span>
        <span>Win rate: {percent(summary.wins, summary.losses)}</span>
        <span>Resting: {summary.restingReached ? 'Yes' : 'No'}</span>
        <span>Level-up: {summary.levelUpDetected ? 'Yes' : 'No'}</span>
      </div>
    </article>
  );
}

export function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('splash');
  const [snapshot, setSnapshot] = useState<DesktopSnapshot>(createEmptySnapshot());
  const [accountMode, setAccountMode] = useState<AccountMode>('saved');
  const [selectedAccountLabel, setSelectedAccountLabel] = useState<string>('');
  const [accountForm, setAccountForm] = useState<DesktopAccountForm>(createEmptyAccountForm());
  const [loginError, setLoginError] = useState<string>('');
  const [generalError, setGeneralError] = useState<string>('');
  const [showChangeAccountModal, setShowChangeAccountModal] = useState(false);
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<DesktopAccountForm>(createEmptyAccountForm());
  const [runMode, setRunMode] = useState<'single' | 'selected' | 'all-brutes'>('all-brutes');
  const [selectedBruteNames, setSelectedBruteNames] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<DesktopPreferences>(createDefaultPreferences());

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const initialSnapshot = await window.bruteControlApi.run.status();
      if (!mounted) {
        return;
      }

      setSnapshot(initialSnapshot);
      setPreferences(initialSnapshot.preferences);
      if (initialSnapshot.accounts.length > 0) {
        setSelectedAccountLabel(initialSnapshot.accounts[0].label);
      } else {
        setAccountMode('new');
      }
    };

    void bootstrap();
    const unsubscribe = window.bruteControlApi.onRunEvent(async (event) => {
      const nextSnapshot = await window.bruteControlApi.run.status();
      setSnapshot(nextSnapshot);
      setPreferences(nextSnapshot.preferences);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const visibleLogs = useMemo(() =>
    snapshot.run.logs.filter((entry) => preferences.showDetailedLogs || entry.level !== 'DEBUG'), [
      preferences.showDetailedLogs,
      snapshot.run.logs,
    ]);

  const currentWinRate = percent(snapshot.run.metrics.totalWins, snapshot.run.metrics.totalLosses);

  async function refreshAccounts(): Promise<void> {
    const accounts = await window.bruteControlApi.accounts.list();
    setSnapshot((current) => ({ ...current, accounts }));
    if (accounts.length > 0 && !accounts.find((account) => account.label === selectedAccountLabel)) {
      setSelectedAccountLabel(accounts[0].label);
    }
  }

  async function handleEnter(): Promise<void> {
    await refreshAccounts();
    setScreen('accounts');
    setLoginError('');
  }

  async function handleLoginSubmit(): Promise<void> {
    setLoginError('');
    try {
      let response: DesktopLoginResponse;
      if (accountMode === 'saved' && selectedAccountLabel) {
        response = await window.bruteControlApi.auth.login({
          accountLabel: selectedAccountLabel,
        });
      } else {
        response = await window.bruteControlApi.auth.login({
          form: accountForm,
        });
      }

      setSnapshot(response.snapshot);
      setPreferences(response.preferences);
      setRunMode(response.preferences.runMode);
      setSelectedBruteNames([]);
      setScreen('dashboard');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleStartRun(): Promise<void> {
    setGeneralError('');
    if (runMode === 'single' && selectedBruteNames.length !== 1) {
      setGeneralError('En modo "Un bruto" debes seleccionar exactamente un bruto.');
      return;
    }

    if (runMode === 'selected' && selectedBruteNames.length === 0) {
      setGeneralError('Selecciona al menos un bruto antes de iniciar la ejecución.');
      return;
    }

    const nextPreferences = await window.bruteControlApi.preferences.save({
      ...preferences,
      runMode,
    });
    setPreferences(nextPreferences);
    const options: DesktopRunOptions = {
      mode: runMode,
      bruteNames: selectedBruteNames,
      preferences: nextPreferences,
    };

    try {
      const nextSnapshot = await window.bruteControlApi.run.start(options);
      setSnapshot(nextSnapshot);
    } catch (error) {
      setGeneralError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleCancelRun(): Promise<void> {
    setGeneralError('');
    const nextSnapshot = await window.bruteControlApi.run.cancel();
    setSnapshot(nextSnapshot);
  }

  async function handleLevelUpContinue(): Promise<void> {
    const nextSnapshot = await window.bruteControlApi.run.continueAfterLevelUp();
    setSnapshot(nextSnapshot);
  }

  async function handleDeleteCurrentAccount(): Promise<void> {
    if (!snapshot.currentAccount) {
      return;
    }
    if (!window.confirm(`¿Eliminar la cuenta ${snapshot.currentAccount.label}?`)) {
      return;
    }

    await window.bruteControlApi.accounts.delete(snapshot.currentAccount.label);
    await refreshAccounts();
    const nextSnapshot = await window.bruteControlApi.run.status();
    setSnapshot(nextSnapshot);
    setScreen('accounts');
  }

  async function handleAccountSwitch(label: string): Promise<void> {
    setShowChangeAccountModal(false);
    if (snapshot.run.isRunning && !window.confirm('Cambiar de cuenta detendrá la ejecución actual. ¿Continuar?')) {
      return;
    }

    if (snapshot.run.isRunning || snapshot.run.isPaused) {
      await window.bruteControlApi.run.cancel();
    }

    setSelectedAccountLabel(label);
    setScreen('accounts');
    setAccountMode('saved');
  }

  async function handleSaveEditedAccount(): Promise<void> {
    if (!snapshot.currentAccount) {
      return;
    }

    try {
      const accounts = await window.bruteControlApi.accounts.update({
        previousLabel: snapshot.currentAccount.label,
        form: {
          label: editingAccount.label,
          username: editingAccount.username,
          password: editingAccount.password,
        },
      });
      setSnapshot((current) => ({ ...current, accounts }));
      setShowEditAccountModal(false);
      setEditingAccount(createEmptyAccountForm());
    } catch (error) {
      setGeneralError(error instanceof Error ? error.message : String(error));
    }
  }

  function renderSplash(): React.ReactElement {
    return (
      <main className="splash-screen">
        <div className="splash-overlay" />
        <section className="splash-content">
          <p className="eyebrow">EternalTwin Arena Automation</p>
          <h1>El Bruto Control</h1>
          <p className="lead">
            Controla tus cuentas, lanza tus combates y sigue el estado de cada bruto con un panel
            visual inspirado en la arena.
          </p>
          <button type="button" className="hero-button" onClick={() => void handleEnter()}>
            Entrar
          </button>
        </section>
      </main>
    );
  }

  function renderAccountSelection(): React.ReactElement {
    return (
      <main className="account-screen">
        <section className="account-panel">
          <div className="account-panel-header">
            <h2>Acceso al Coliseo</h2>
            <p>Elige una cuenta guardada o entra con una nueva para cargar tus brutos.</p>
          </div>
          {snapshot.accounts.length > 0 && (
            <div className="segmented">
              <button
                type="button"
                className={accountMode === 'saved' ? 'segmented-active' : ''}
                onClick={() => setAccountMode('saved')}
              >
                Cuenta guardada
              </button>
              <button
                type="button"
                className={accountMode === 'new' ? 'segmented-active' : ''}
                onClick={() => setAccountMode('new')}
              >
                Nueva cuenta
              </button>
            </div>
          )}
          {accountMode === 'saved' && snapshot.accounts.length > 0 ? (
            <div className="account-list">
              {snapshot.accounts.map((account) => (
                <label key={account.label} className="saved-account-row">
                  <input
                    type="radio"
                    name="saved-account"
                    checked={selectedAccountLabel === account.label}
                    onChange={() => setSelectedAccountLabel(account.label)}
                  />
                  <div>
                    <strong>{account.label}</strong>
                    <span>{account.username}</span>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="form-grid">
              <label>
                Alias
                <input
                  value={accountForm.label}
                  onChange={(event) => setAccountForm((current) => ({ ...current, label: event.target.value }))}
                />
              </label>
              <label>
                Usuario
                <input
                  value={accountForm.username}
                  onChange={(event) => setAccountForm((current) => ({ ...current, username: event.target.value }))}
                />
              </label>
              <label>
                Contraseña
                <input
                  type="password"
                  value={accountForm.password}
                  onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={accountForm.saveAccount}
                  onChange={(event) => setAccountForm((current) => ({ ...current, saveAccount: event.target.checked }))}
                />
                Guardar esta cuenta si el login funciona
              </label>
            </div>
          )}
          {loginError ? <p className="inline-error">{loginError}</p> : null}
          <div className="account-actions">
            <button type="button" className="ghost-button" onClick={() => setScreen('splash')}>
              Volver
            </button>
            <button type="button" className="primary-button" onClick={() => void handleLoginSubmit()}>
              Continuar
            </button>
          </div>
        </section>
      </main>
    );
  }

  function renderDashboard(): React.ReactElement {
    return (
      <main className="dashboard-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Cuenta activa</p>
            <h2>{snapshot.currentAccount?.label ?? 'Sin cuenta'}</h2>
            <span className="muted">{snapshot.currentAccount?.username ?? 'No autenticada'}</span>
          </div>
          <div className="topbar-actions">
            <button type="button" className="ghost-button" onClick={() => setShowChangeAccountModal(true)}>
              Cambiar cuenta
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setEditingAccount({
                  label: snapshot.currentAccount?.label ?? '',
                  username: snapshot.currentAccount?.username ?? '',
                  password: '',
                  saveAccount: true,
                });
                setShowEditAccountModal(true);
              }}
              disabled={!snapshot.currentAccount}
            >
              Editar cuenta
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setAccountMode('new');
                setAccountForm(createEmptyAccountForm());
                setScreen('accounts');
              }}
            >
              Añadir cuenta
            </button>
            <button type="button" className="danger-button" onClick={() => void handleDeleteCurrentAccount()}>
              Eliminar cuenta
            </button>
          </div>
        </header>

        <section className="dashboard-grid">
          <aside className="left-panel">
            <section className="panel-card">
              <h3>Configuración de ejecución</h3>
              <label>
                Modo
                <select value={runMode} onChange={(event) => setRunMode(event.target.value as typeof runMode)}>
                  <option value="single">Un bruto</option>
                  <option value="selected">Varios brutos</option>
                  <option value="all-brutes">Todos los brutos</option>
                </select>
              </label>
              <div className="brute-selector">
                <div className="section-row">
                  <span>Brutos</span>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="ghost-button mini"
                      onClick={() => setSelectedBruteNames([...snapshot.bruteNames])}
                    >
                      Seleccionar todos
                    </button>
                    <button
                      type="button"
                      className="ghost-button mini"
                      onClick={() => setSelectedBruteNames([])}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
                {snapshot.bruteNames.map((bruteName) => (
                  <label key={bruteName} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={selectedBruteNames.includes(bruteName)}
                      disabled={runMode === 'all-brutes'}
                      onChange={(event) => {
                        setSelectedBruteNames((current) =>
                          runMode === 'single'
                            ? (event.target.checked ? [bruteName] : [])
                            : event.target.checked
                              ? [...new Set([...current, bruteName])]
                              : current.filter((value) => value !== bruteName));
                      }}
                    />
                    {bruteName}
                  </label>
                ))}
              </div>
              <label>
                Al subir de nivel
                <select
                  value={preferences.levelUpBehavior}
                  onChange={(event) => setPreferences((current) => ({
                    ...current,
                    levelUpBehavior: event.target.value as DesktopPreferences['levelUpBehavior'],
                  }))}
                >
                  <option value="skip_brute">Saltar bruto</option>
                  <option value="wait_for_manual_resume">Esperar a que yo lo haga manualmente</option>
                </select>
              </label>
              <label>
                Al terminar
                <select
                  value={preferences.completionBehavior}
                  onChange={(event) => setPreferences((current) => ({
                    ...current,
                    completionBehavior: event.target.value as DesktopPreferences['completionBehavior'],
                  }))}
                >
                  <option value="close_program">Cerrar Chromium y finalizar</option>
                  <option value="keep_browser_open">Dejar Chromium abierto</option>
                </select>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={preferences.preClickDelayEnabled}
                  onChange={(event) => setPreferences((current) => ({
                    ...current,
                    preClickDelayEnabled: event.target.checked,
                  }))}
                />
                Delay aleatorio antes de click
              </label>
              <label>
                Máximo (segundos)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={preferences.maxPreClickDelaySeconds}
                  onChange={(event) => setPreferences((current) => ({
                    ...current,
                    maxPreClickDelaySeconds: Number.parseFloat(event.target.value || '0'),
                  }))}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={preferences.showDetailedLogs}
                  onChange={(event) => setPreferences((current) => ({
                    ...current,
                    showDetailedLogs: event.target.checked,
                  }))}
                />
                Mostrar logs detallados
              </label>
            </section>

            <section className="panel-card action-panel">
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleStartRun()}
                disabled={snapshot.run.isRunning}
              >
                Iniciar ejecución
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void handleCancelRun()}
                disabled={!snapshot.run.isRunning && !snapshot.run.isPaused}
              >
                Cancelar / Detener
              </button>
              {generalError ? <p className="inline-error">{generalError}</p> : null}
            </section>

            <section className="panel-card">
              <h3>Resumen global</h3>
              <div className="summary-grid">
                <SummaryCard label="Cuenta" value={snapshot.currentAccount?.label ?? '--'} />
                <SummaryCard label="Brutos" value={snapshot.run.metrics.totalBrutesProcessed} />
                <SummaryCard label="Fights" value={snapshot.run.metrics.totalFightsCompleted} />
                <SummaryCard label="Wins" value={snapshot.run.metrics.totalWins} />
                <SummaryCard label="Losses" value={snapshot.run.metrics.totalLosses} />
                <SummaryCard label="Win rate" value={currentWinRate} />
                <SummaryCard label="Resting" value={snapshot.run.metrics.restingCount} />
                <SummaryCard label="Level-up" value={snapshot.run.metrics.manualInterventionCount} />
                <SummaryCard label="Errors" value={snapshot.run.metrics.errorCount} />
                <SummaryCard label="Duration" value={durationSince(snapshot.run.startedAt)} />
              </div>
            </section>

            <section className="panel-card">
              <div className="section-row">
                <h3>Resumen por bruto</h3>
                <span className="muted">{snapshot.run.summaries.length} actualizados</span>
              </div>
              <div className="brute-summary-list">
                {snapshot.run.summaries.length > 0 ? snapshot.run.summaries.map((summary) => (
                  <BruteSummaryCard key={summary.bruteName} summary={summary} />
                )) : <p className="muted">Todavía no hay resumen de brutos.</p>}
              </div>
            </section>
          </aside>

          <section className="right-panel">
            <section className="panel-card status-card">
              <div className="status-header">
                <div>
                  <p className="eyebrow">Estado actual</p>
                  <h3>{friendlyState(snapshot.run.currentState)}</h3>
                </div>
                <div className={`status-pill ${snapshot.run.isPaused ? 'paused' : snapshot.run.isRunning ? 'running' : 'idle'}`}>
                  {snapshot.run.isPaused ? 'Paused' : snapshot.run.isRunning ? 'Running' : 'Idle'}
                </div>
              </div>
              <div className="status-grid">
                <SummaryCard label="Bruto actual" value={snapshot.run.currentBruteName ?? '--'} />
                <SummaryCard label="Duration" value={durationSince(snapshot.run.startedAt)} />
                <SummaryCard label="Wins" value={snapshot.run.metrics.totalWins} />
                <SummaryCard label="Losses" value={snapshot.run.metrics.totalLosses} />
                <SummaryCard label="Win rate" value={currentWinRate} />
              </div>
            </section>

            <section className="panel-card progress-card">
              <div className="section-row">
                <h3>Progreso del ciclo</h3>
                <span className="muted">{snapshot.bruteNames.length} brutos cargados</span>
              </div>
              <div className="progress-table">
                <div className="progress-table-head">
                  <span>Bruto</span>
                  <span>Estado</span>
                  <span>Fights</span>
                  <span>Wins</span>
                  <span>Losses</span>
                  <span>Win rate</span>
                </div>
                {snapshot.bruteNames.map((bruteName) => {
                  const summary = snapshot.run.summaries.find((item) => item.bruteName === bruteName);
                  const state = bruteName === snapshot.run.currentBruteName
                    ? friendlyState(snapshot.run.currentState)
                    : summary?.finalStatus
                      ? summary.finalStatus
                      : 'Pending';
                  return (
                    <div className="progress-row" key={bruteName}>
                      <span>{bruteName}</span>
                      <span>{state}</span>
                      <span>{summary?.fightsCompleted ?? 0}</span>
                      <span>{summary?.wins ?? 0}</span>
                      <span>{summary?.losses ?? 0}</span>
                      <span>{summary ? percent(summary.wins, summary.losses) : 'n/a'}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel-card logs-card">
              <div className="section-row">
                <h3>Logs</h3>
                <div className="inline-actions">
                  <button type="button" className="ghost-button mini" onClick={() => void window.bruteControlApi.system.openLogsFolder()}>
                    Abrir carpeta de logs
                  </button>
                  <button type="button" className="ghost-button mini" onClick={() => void window.bruteControlApi.system.openArtifactsFolder()}>
                    Abrir artefactos
                  </button>
                </div>
              </div>
              <div className="log-console">
                {visibleLogs.length > 0 ? visibleLogs.map((entry) => (
                  <div key={`${entry.timestamp}-${entry.line}`} className={`log-line ${entry.level.toLowerCase()}`}>
                    <span className="log-timestamp">{entry.timestamp}</span>
                    <span className="log-level">{entry.level}</span>
                    <span>{entry.message}</span>
                  </div>
                )) : <p className="muted">Los logs aparecerán aquí en tiempo real.</p>}
              </div>
            </section>
          </section>
        </section>

        {snapshot.run.isPaused && (
          <Modal title="LEVEL UP" onClose={() => void handleCancelRun()}>
            <p>
              <strong>{snapshot.run.currentBruteName ?? 'Un bruto'}</strong> ha subido de nivel.
              Chromium seguirá abierto para que lo gestiones manualmente.
            </p>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => void handleCancelRun()}>
                Abortar ejecución
              </button>
              <button type="button" className="primary-button" onClick={() => void handleLevelUpContinue()}>
                Continuar
              </button>
            </div>
          </Modal>
        )}

        {showChangeAccountModal && (
          <Modal title="Cambiar cuenta" onClose={() => setShowChangeAccountModal(false)}>
            <div className="account-list">
              {snapshot.accounts.map((account) => (
                <button
                  type="button"
                  key={account.label}
                  className="account-switch-row"
                  onClick={() => void handleAccountSwitch(account.label)}
                >
                  <strong>{account.label}</strong>
                  <span>{account.username}</span>
                </button>
              ))}
            </div>
          </Modal>
        )}

        {showEditAccountModal && (
          <Modal title="Editar cuenta" onClose={() => setShowEditAccountModal(false)}>
            <div className="form-grid">
              <label>
                Alias
                <input
                  value={editingAccount.label}
                  onChange={(event) => setEditingAccount((current) => ({ ...current, label: event.target.value }))}
                />
              </label>
              <label>
                Usuario
                <input
                  value={editingAccount.username}
                  onChange={(event) => setEditingAccount((current) => ({ ...current, username: event.target.value }))}
                />
              </label>
              <label>
                Nueva contraseña
                <input
                  type="password"
                  value={editingAccount.password}
                  onChange={(event) => setEditingAccount((current) => ({ ...current, password: event.target.value }))}
                />
              </label>
              <p className="muted">Si quieres mantener la contraseña actual, déjala vacía.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setShowEditAccountModal(false)}>
                Cancelar
              </button>
              <button type="button" className="primary-button" onClick={() => void handleSaveEditedAccount()}>
                Guardar cambios
              </button>
            </div>
          </Modal>
        )}
      </main>
    );
  }

  if (screen === 'splash') {
    return renderSplash();
  }

  if (screen === 'accounts') {
    return renderAccountSelection();
  }

  return renderDashboard();
}
