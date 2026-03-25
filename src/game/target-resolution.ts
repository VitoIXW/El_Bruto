import type { PageState, StateDetectionDetails } from '../types/run-types';
import type { StableStatePhase } from './startup';

const POST_LOGIN_TRANSIENT_STATES: PageState[] = [
  'public_home',
  'login_form',
  'authenticated_home',
  'login_required',
  'unknown',
];

const LOGIN_TRANSIENT_STATES: PageState[] = ['public_home', 'login_required', 'unknown'];

export function extractTargetBruteName(targetUrl: string): string | undefined {
  const match = targetUrl.match(/brute\.eternaltwin\.org\/([^/]+)\/(cell|arena|fight)/i);
  return match?.[1];
}

export function isTransientState(state: PageState, phase: StableStatePhase = 'post_login'): boolean {
  const transientStates = phase === 'login' ? LOGIN_TRANSIENT_STATES : POST_LOGIN_TRANSIENT_STATES;
  return transientStates.includes(state);
}

export function isTargetBruteLoaded(targetBruteName: string | undefined, state: StateDetectionDetails): boolean {
  if (!targetBruteName || !state.bruteNameFromPage) {
    return false;
  }

  return targetBruteName.toLowerCase() === state.bruteNameFromPage.toLowerCase();
}
