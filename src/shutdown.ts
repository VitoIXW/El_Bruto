export interface ShutdownLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface SignalSource {
  once(event: NodeJS.Signals, listener: () => void): unknown;
  off(event: NodeJS.Signals, listener: () => void): unknown;
}

export interface ShutdownRegistrationOptions {
  signalSource?: SignalSource;
  exit?: (code: number) => void;
}

export function registerGracefulShutdown(
  cleanup: () => Promise<void>,
  logger: ShutdownLogger,
  options: ShutdownRegistrationOptions = {},
): () => void {
  const signalSource = options.signalSource ?? process;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  let shuttingDown = false;

  const unregister = () => {
    signalSource.off('SIGINT', onSigint);
    signalSource.off('SIGTERM', onSigterm);
  };

  const handleSignal = async (signal: NodeJS.Signals, exitCode: number) => {
    if (shuttingDown) {
      logger.warn(`Received ${signal} again while shutting down. Forcing exit.`);
      unregister();
      exit(exitCode);
      return;
    }

    shuttingDown = true;
    logger.warn(`Received ${signal}. Closing browser session before exit.`);

    try {
      await cleanup();
    } catch (error: unknown) {
      logger.error(
        `Failed while cleaning up after ${signal}: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      unregister();
      exit(exitCode);
    }
  };

  const onSigint = () => {
    void handleSignal('SIGINT', 130);
  };

  const onSigterm = () => {
    void handleSignal('SIGTERM', 143);
  };

  signalSource.once('SIGINT', onSigint);
  signalSource.once('SIGTERM', onSigterm);

  return unregister;
}
