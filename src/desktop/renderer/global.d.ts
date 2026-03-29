import type { DesktopApi } from '../shared/contracts';

declare global {
  interface Window {
    bruteControlApi: DesktopApi;
  }
}

export {};

