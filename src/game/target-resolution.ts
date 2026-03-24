import type { PageState, StateDetectionDetails } from '../types/run-types';

const TRANSIENT_STATES: PageState[] = ['login_required', 'unknown'];

export function extractTargetBruteName(targetUrl: string): string | undefined {
  const match = targetUrl.match(/brute\.eternaltwin\.org\/([^/]+)\/(cell|arena|fight)/i);
  return match?.[1];
}

export function isTransientState(state: PageState): boolean {
  return TRANSIENT_STATES.includes(state);
}

export function isTargetBruteLoaded(targetBruteName: string | undefined, state: StateDetectionDetails): boolean {
  if (!targetBruteName || !state.bruteNameFromPage) {
    return false;
  }

  return targetBruteName.toLowerCase() === state.bruteNameFromPage.toLowerCase();
}
