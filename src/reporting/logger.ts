import fs from 'node:fs';
import path from 'node:path';

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
  logFilePath: string;
  supportsColor?: boolean;
}

function timestamp(): string {
  return new Date().toISOString();
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}

export function createLogger(logsDir: string, debugEnabled: boolean): Logger {
  fs.mkdirSync(logsDir, { recursive: true });
  const logFilePath = path.join(logsDir, `${timestamp().replace(/[:.]/g, '-')}-run.log`);
  const supportsColor = process.stdout.isTTY === true
    && (typeof process.stdout.getColorDepth === 'function' ? process.stdout.getColorDepth() : 0) >= 8;

  const write = (level: string, message: string, printToConsole = true): void => {
    const line = `[${timestamp()}] [${level}] ${message}`;
    fs.appendFileSync(logFilePath, `${stripAnsi(line)}\n`, 'utf8');
    if (printToConsole) {
      console.log(line);
    }
  };

  return {
    info(message) {
      write('INFO', message);
    },
    warn(message) {
      write('WARN', message);
    },
    error(message) {
      write('ERROR', message);
    },
    debug(message) {
      write('DEBUG', message, debugEnabled);
    },
    logFilePath,
    supportsColor,
  };
}
