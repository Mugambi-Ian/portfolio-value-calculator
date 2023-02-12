/* eslint-disable @typescript-eslint/no-explicit-any */
import chalk from 'chalk';
import {readFile} from 'fs';
import path, {resolve} from 'path';

const __dirname = path.dirname('');
export const TITLE_PATH = resolve(__dirname + '/assets/title.txt');
export const CSV_PATH = resolve(__dirname + '/assets/transactions.csv');
export const INDEX_CSV_WORKER = resolve(__dirname + '/workers/indexCSV.js');
export const WRITE_GROUP_WORKER = resolve(__dirname + '/workers/writeGroup.js');

export const LOADER_MSG = 'Fetching ⌛ ⌛ ⌛';
export const CHECK_SYNC_MSG = 'Checking 🛠️  🛠️  🛠️';

export const emptyLines = (lines: number) =>
  new Array(lines).fill(' ').join('\n');

interface IPrintOptions {
  clear?: boolean;
  removePreviousLines?: number;
}

let logs: unknown[] = [];
export const appClear = () => console.clear();
export const appPrint = (log: unknown, options?: IPrintOptions) => {
  if (options?.clear) logs = [];
  if (options?.removePreviousLines && !options.clear)
    logs = logs.slice(0, logs.length - options.removePreviousLines);
  if (Array.isArray(log)) logs = [...logs, ...log];
  else if (log) logs.push(log);
  appClear();
  console.log(...logs);
  return logs;
};

interface FunctionWithParams {
  (...params: any[]): any;
}
export class MemoFunction {
  funcs = new Map<string, any>();
  runOnce(fn: FunctionWithParams): FunctionWithParams {
    return async (...params: any[]) => {
      const keys = params.filter(x => this.isSerializable(x));
      const key = JSON.stringify(keys);
      if (this.funcs.has(key)) {
        return this.funcs.get(key);
      }
      const result = await fn(...params);
      this.funcs.set(key, result);
      return result;
    };
  }
  clearMemoFuncs() {
    this.funcs = new Map<string, any>();
  }

  isSerializable(obj: unknown) {
    try {
      JSON.stringify(obj);
      return true;
    } catch (e) {
      return false;
    }
  }
}

export class PrintOnce extends MemoFunction {
  printOnce(s: string) {
    appPrint(s, {
      removePreviousLines: 1,
    });
  }
  constructor() {
    super();
    this.runOnce(this.printOnce);
  }
}

export function objectToText(obj: unknown) {
  return JSON.stringify(obj)
    .replace(/:/g, ': ')
    .replace(/,(?=[^"]*(?:"[^"]*"[^"]*)*$)/g, '  ')
    .replace(/[{}"']/g, '');
}

export function printUSD(n: number) {
  return (
    '$' +
    n
      .toFixed(2)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  );
}
function getTitle(): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile(TITLE_PATH, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

export async function printTitle() {
  return (
    `${chalk.yellow(await getTitle())}` +
    `${chalk.blue(
      '\n\nA Command Line Program To Calculate The Portfolio Value For A Crypto Investor'
    )}.` +
    '\nCSV Path: ' +
    chalk.bgGreen(CSV_PATH + '\n')
  );
}
