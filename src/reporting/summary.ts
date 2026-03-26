import type { AccountRunSummary, RunSummary } from '../types/run-types';

interface SummaryFormatOptions {
  color?: boolean;
}

const ANSI_RESET = '\u001B[0m';
const ANSI_GREEN = '\u001B[32m';
const ANSI_YELLOW = '\u001B[33m';
const ANSI_RED = '\u001B[31m';
const ANSI_CYAN = '\u001B[36m';
const ANSI_BOLD = '\u001B[1m';
const ANSI_DIM = '\u001B[2m';

function applyColor(enabled: boolean | undefined, text: string, ...codes: string[]): string {
  if (!enabled || codes.length === 0) {
    return text;
  }
  return `${codes.join('')}${text}${ANSI_RESET}`;
}

function formatBoolean(value: boolean): string {
  return value ? 'yes' : 'no';
}

function formatFinalStatus(status: RunSummary['finalStatus']): string {
  return status.replace(/_/g, ' ');
}

function summarizeBruteOutcome(summary: RunSummary, color: boolean | undefined): string {
  const statusTone = summary.errorsOccurred
    ? ANSI_RED
    : summary.finalStatus === 'manual_intervention_required'
      ? ANSI_YELLOW
      : summary.finalStatus === 'resting'
        ? ANSI_GREEN
        : ANSI_CYAN;
  const statusLabel = applyColor(color, formatFinalStatus(summary.finalStatus), ANSI_BOLD, statusTone);
  return [
    applyColor(color, summary.bruteName, ANSI_BOLD),
    `status=${statusLabel}`,
    `fights=${summary.fightsCompleted}`,
    `wins=${summary.wins}`,
    `losses=${summary.losses}`,
    `resting=${formatBoolean(summary.restingReached)}`,
    `level-up=${formatBoolean(summary.levelUpDetected)}`,
    `errors=${formatBoolean(summary.errorsOccurred)}`,
  ].join(' | ');
}

export function formatSummary(summary: RunSummary, options: SummaryFormatOptions = {}): string {
  const { color } = options;
  const statusTone = summary.errorsOccurred
    ? ANSI_RED
    : summary.finalStatus === 'manual_intervention_required'
      ? ANSI_YELLOW
      : summary.finalStatus === 'resting'
        ? ANSI_GREEN
        : ANSI_CYAN;
  const lines = [
    applyColor(color, 'Run Summary', ANSI_BOLD, ANSI_CYAN),
    `${applyColor(color, 'Brute', ANSI_BOLD)}: ${applyColor(color, summary.bruteName, ANSI_BOLD)}`,
    `${applyColor(color, 'Status', ANSI_BOLD)}: ${applyColor(color, formatFinalStatus(summary.finalStatus), ANSI_BOLD, statusTone)}`,
    `${applyColor(color, 'Fights', ANSI_BOLD)}: ${summary.fightsCompleted}`,
    `${applyColor(color, 'Wins', ANSI_BOLD)}: ${summary.wins}`,
    `${applyColor(color, 'Losses', ANSI_BOLD)}: ${summary.losses}`,
    `${applyColor(color, 'Resting', ANSI_BOLD)}: ${formatBoolean(summary.restingReached)}`,
    `${applyColor(color, 'Level-up', ANSI_BOLD)}: ${formatBoolean(summary.levelUpDetected)}`,
    `${applyColor(color, 'Errors', ANSI_BOLD)}: ${formatBoolean(summary.errorsOccurred)}`,
  ];

  if (summary.finalStatus === 'manual_intervention_required' && summary.levelUpDetected) {
    lines.push(`${applyColor(color, 'Reason', ANSI_BOLD)}: The brute leveled up and requires a manual upgrade choice before continuing.`);
  }

  if (summary.artifacts?.screenshotPath) {
    lines.push(`${applyColor(color, 'Screenshot', ANSI_DIM)}: ${summary.artifacts.screenshotPath}`);
  }
  if (summary.artifacts?.htmlPath) {
    lines.push(`${applyColor(color, 'HTML snapshot', ANSI_DIM)}: ${summary.artifacts.htmlPath}`);
  }

  return lines.join('\n');
}

export function formatAccountSummary(summary: AccountRunSummary, options: SummaryFormatOptions = {}): string {
  const { color } = options;
  const outcomeLabel = summary.advanceFailed
    ? applyColor(color, 'INCOMPLETE', ANSI_BOLD, ANSI_RED)
    : summary.cycleCompleted
      ? applyColor(color, 'COMPLETE', ANSI_BOLD, ANSI_GREEN)
      : applyColor(color, 'PARTIAL', ANSI_BOLD, ANSI_YELLOW);
  const lines = [
    applyColor(color, 'Account Run Summary', ANSI_BOLD, ANSI_CYAN),
    `${applyColor(color, 'Outcome', ANSI_BOLD)}: ${outcomeLabel}`,
    `${applyColor(color, 'Started brute', ANSI_BOLD)}: ${summary.startedBruteName}`,
    `${applyColor(color, 'Brutes processed', ANSI_BOLD)}: ${summary.totalBrutesProcessed}`,
    `${applyColor(color, 'Total fights', ANSI_BOLD)}: ${summary.totalFightsCompleted}`,
    `${applyColor(color, 'Total wins', ANSI_BOLD)}: ${summary.totalWins}`,
    `${applyColor(color, 'Total losses', ANSI_BOLD)}: ${summary.totalLosses}`,
    `${applyColor(color, 'Resting', ANSI_BOLD)}: ${summary.restingCount}`,
    `${applyColor(color, 'Manual intervention', ANSI_BOLD)}: ${summary.manualInterventionCount}`,
    `${applyColor(color, 'Errors', ANSI_BOLD)}: ${summary.errorCount}`,
  ];

  if (summary.failureReason) {
    lines.push(`${applyColor(color, 'Failure reason', ANSI_BOLD, ANSI_RED)}: ${summary.failureReason}`);
  }

  lines.push('');
  lines.push(applyColor(color, 'Per-brute results', ANSI_BOLD));
  lines.push(...summary.brutes.map((brute) => `- ${summarizeBruteOutcome(brute, color)}`));

  return lines.join('\n');
}
