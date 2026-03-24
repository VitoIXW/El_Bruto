import type { RunSummary } from '../types/run-types';

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
