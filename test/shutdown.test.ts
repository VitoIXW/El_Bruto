import test from 'node:test';
import assert from 'node:assert/strict';

import { registerGracefulShutdown, type ShutdownLogger, type SignalSource } from '../src/shutdown';

class FakeSignalSource implements SignalSource {
  private listeners = new Map<NodeJS.Signals, () => void>();

  once(event: NodeJS.Signals, listener: () => void): void {
    this.listeners.set(event, listener);
  }

  off(event: NodeJS.Signals, listener: () => void): void {
    if (this.listeners.get(event) === listener) {
      this.listeners.delete(event);
    }
  }

  emit(event: NodeJS.Signals): void {
    this.listeners.get(event)?.();
  }
}

function createLogger() {
  const messages = {
    info: [] as string[],
    warn: [] as string[],
    error: [] as string[],
  };

  const logger: ShutdownLogger = {
    info(message: string) {
      messages.info.push(message);
    },
    warn(message: string) {
      messages.warn.push(message);
    },
    error(message: string) {
      messages.error.push(message);
    },
  };

  return { logger, messages };
}

test('registerGracefulShutdown cleans up and exits on SIGINT', async () => {
  const signalSource = new FakeSignalSource();
  const { logger, messages } = createLogger();
  const events: string[] = [];
  let cleanupResolve: (() => void) | undefined;

  const unregister = registerGracefulShutdown(
    () => new Promise<void>((resolve) => {
      events.push('cleanup-started');
      cleanupResolve = () => {
        events.push('cleanup-finished');
        resolve();
      };
    }),
    logger,
    {
      signalSource,
      exit(code) {
        events.push(`exit:${code}`);
      },
    },
  );

  signalSource.emit('SIGINT');
  assert.deepEqual(events, ['cleanup-started']);

  cleanupResolve?.();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(events, ['cleanup-started', 'cleanup-finished', 'exit:130']);
  assert.deepEqual(messages.warn, [
    'Received SIGINT. Closing browser session before exit.',
  ]);

  unregister();
});

test('registerGracefulShutdown forces exit on repeated signal', async () => {
  const signalSource = new FakeSignalSource();
  const { logger, messages } = createLogger();
  const events: string[] = [];

  registerGracefulShutdown(
    () => new Promise<void>(() => {
      events.push('cleanup-started');
    }),
    logger,
    {
      signalSource,
      exit(code) {
        events.push(`exit:${code}`);
      },
    },
  );

  signalSource.emit('SIGINT');
  signalSource.emit('SIGINT');

  assert.deepEqual(events, ['cleanup-started', 'exit:130']);
  assert.deepEqual(messages.warn, [
    'Received SIGINT. Closing browser session before exit.',
    'Received SIGINT again while shutting down. Forcing exit.',
  ]);
});
