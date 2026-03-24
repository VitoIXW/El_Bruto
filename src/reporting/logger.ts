import fs from 'node:fs';
import path from 'node:path';

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
  logFilePath: string;
}

function timestamp(): string {
  return new Date().toISOString();
}

export function createLogger(logsDir: string, debugEnabled: boolean): Logger {
  fs.mkdirSync(logsDir, { recursive: true });
  const logFilePath = path.join(logsDir, `${timestamp().replace(/[:.]/g, '-')}-run.log`);

  const write = (level: string, message: string, alwaysPrint = true): void => {
    const line = `[${timestamp()}] [${level}] ${message}`;
    fs.appendFileSync(logFilePath, `${line}\n`, 'utf8');
    if (alwaysPrint) {
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
      if (debugEnabled) {
        write('DEBUG', message);
      }
    },
    logFilePath,
  };
}
