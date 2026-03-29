import type { RunConfig } from '../types/run-types';

export class RunCancelledError extends Error {
  constructor(message = 'Run cancelled by user.') {
    super(message);
    this.name = 'RunCancelledError';
  }
}

export function isRunCancelled(config: Pick<RunConfig, 'stopSignal'>): boolean {
  return config.stopSignal?.aborted === true;
}

export function throwIfRunCancelled(config: Pick<RunConfig, 'stopSignal'>): void {
  if (isRunCancelled(config)) {
    throw new RunCancelledError();
  }
}
