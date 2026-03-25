import type { AccountRunSummary, RunSummary } from '../types/run-types';

export function formatSummary(summary: RunSummary): string {
  const lines = [
    'Run summary',
    `Brute name: ${summary.bruteName}`,
    `Fights completed: ${summary.fightsCompleted}`,
    `Final status: ${summary.finalStatus}`,
    `Resting reached: ${summary.restingReached}`,
    `Level-up detected: ${summary.levelUpDetected}`,
    `Errors occurred: ${summary.errorsOccurred}`,
  ];

  if (summary.finalStatus === 'manual_intervention_required' && summary.levelUpDetected) {
    lines.push('Reason: The brute leveled up and requires a manual upgrade choice before continuing.');
  }

  if (summary.artifacts?.screenshotPath) {
    lines.push(`Screenshot: ${summary.artifacts.screenshotPath}`);
  }
  if (summary.artifacts?.htmlPath) {
    lines.push(`HTML snapshot: ${summary.artifacts.htmlPath}`);
  }

  return lines.join('\n');
}

export function formatAccountSummary(summary: AccountRunSummary): string {
  const lines = [
    'Account run summary',
    `Started brute: ${summary.startedBruteName}`,
    `Cycle completed: ${summary.cycleCompleted}`,
    `Advance failed: ${summary.advanceFailed}`,
    `Brutes processed: ${summary.totalBrutesProcessed}`,
    `Total fights completed: ${summary.totalFightsCompleted}`,
    `Resting brutes: ${summary.restingCount}`,
    `Manual intervention required: ${summary.manualInterventionCount}`,
    `Errors: ${summary.errorCount}`,
    'Per-brute results:',
    ...summary.brutes.map((brute) =>
      `- ${brute.bruteName} | fights=${brute.fightsCompleted} | status=${brute.finalStatus} | resting=${brute.restingReached} | levelUp=${brute.levelUpDetected} | errors=${brute.errorsOccurred}`,
    ),
  ];

  if (summary.failureReason) {
    lines.splice(8, 0, `Failure reason: ${summary.failureReason}`);
  }

  return lines.join('\n');
}
