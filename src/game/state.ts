import type { PageState, StateDetectionDetails } from '../types/run-types';

export interface StateSignals {
  url: string;
  hasLoginForm: boolean;
  hasPasswordInput: boolean;
  hasPublicLoginButton: boolean;
  hasSearchBruteInput: boolean;
  hasPublicBruteNotFoundText: boolean;
  hasUnknownBruteUrl: boolean;
  hasArenaLink: boolean;
  hasArenaWelcomeText: boolean;
  hasArenaSearchInput: boolean;
  hasArenaGoButton: boolean;
  hasOpponentLinks: boolean;
  hasPreFightControl: boolean;
  hasVersusText: boolean;
  hasFightReturnLinks: boolean;
  hasRestingText: boolean;
  hasLevelUpHeading: boolean;
  hasLevelUpChoiceText: boolean;
  bruteNameFromPage?: string;
}

export function classifyState(signals: StateSignals): StateDetectionDetails {
  const notes: string[] = [];
  let state: PageState = 'unknown';

  if (
    signals.hasLoginForm ||
    signals.hasPasswordInput ||
    (signals.hasPublicLoginButton && signals.hasSearchBruteInput) ||
    (
      signals.hasUnknownBruteUrl &&
      (signals.hasPublicLoginButton || signals.hasSearchBruteInput || signals.hasPublicBruteNotFoundText)
    )
  ) {
    state = 'login_required';
    notes.push('login markers detected');
  } else if (signals.hasLevelUpHeading && signals.hasLevelUpChoiceText) {
    state = 'level_up';
    notes.push('level-up markers detected');
  } else if (signals.url.includes('/fight/') && signals.hasFightReturnLinks) {
    state = 'fight';
    notes.push('fight page markers detected');
  } else if (
    (signals.url.includes('/fight/') || signals.url.includes('/versus/')) &&
    (signals.hasPreFightControl || signals.hasVersusText || signals.hasOpponentLinks)
  ) {
    state = 'pre_fight';
    notes.push('pre-fight markers detected');
  } else if (
    signals.url.endsWith('/arena') &&
    (signals.hasOpponentLinks || signals.hasArenaWelcomeText || signals.hasArenaSearchInput || signals.hasArenaGoButton)
  ) {
    state = 'arena_selection';
    notes.push('arena page markers detected');
  } else if (signals.url.endsWith('/cell') && signals.hasRestingText && !signals.hasArenaLink) {
    state = 'cell_resting';
    notes.push('cell resting markers detected');
  } else if (signals.url.endsWith('/cell') && signals.hasArenaLink) {
    state = 'cell_ready';
    notes.push('cell ready markers detected');
  }

  return {
    state,
    url: signals.url,
    bruteNameFromPage: signals.bruteNameFromPage,
    notes,
  };
}
