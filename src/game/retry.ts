import type { PageState } from '../types/run-types';

export function canRetryFromState(expectedState: PageState, currentState: PageState): boolean {
  return expectedState === currentState;
}
