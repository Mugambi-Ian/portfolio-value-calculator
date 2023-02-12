import fs from 'fs';
import chalk from 'chalk';
import csvParser from 'csv-parser';
import {Worker} from 'worker_threads';
import {ICsvIndex} from '../models/CsvIndex.js';
import {MongoClient, Collection, Db} from 'mongodb';
import {
  CSV_PATH,
  appPrint,
  emptyLines,
  INDEX_CSV_WORKER,
  PrintOnce,
  WRITE_GROUP_WORKER,
} from '../utils/index.js';

export class TransactionService extends PrintOnce {
  private transactionsCollection?: Collection;
  private csvSize?: number;
  private uploaded = 0;
  database?: Db;

  async loadDb() {
    const {MONGO_URI, MONGO_DATABASE, MONGO_COLLECTION} = process.env;
    const client = await MongoClient.connect(`${MONGO_URI}`);
    const db = client.db(MONGO_DATABASE);
    try {
      this.transactionsCollection = db.collection(`${MONGO_COLLECTION}`);
      await this.transactionsCollection.stats();
    } catch (err: unknown) {
      // @ts-expect-error message does not exist on type '{}'
      if (err?.message === 'ns not found')
        this.transactionsCollection = await db.createCollection('transactions');
    }
    this.database = db;
    return this.database;
  }

  async checkRecordSync() {
    this.csvSize = await this.getCSVSize();
    return (
      this.csvSize === (await this.transactionsCollection?.countDocuments())
    );
  }

  async migrateRecords(APP_WORKERS: number, CHUNK_SIZE: number) {
    appPrint(
      chalk.gray(
        emptyLines(2) +
          `  Reset Database:  At  ${new Date().toISOString()}` +
          emptyLines(3)
      )
    );
    const headers = await this.getCSVHeader();
    await this.resetCollection();

    appPrint(
      chalk.gray(`Syncing Records:   Start  ${new Date().toISOString()} `) +
        emptyLines(1)
    );

    let completed = 0;
    let ICsvIndex: ICsvIndex = {lineBreaks: [-1], byteBreaks: [-1]};
    while (completed < this.csvSize!) {
      ICsvIndex = await this.indexCSVWorker(ICsvIndex, CHUNK_SIZE);
      completed = ICsvIndex.lineBreaks[ICsvIndex.lineBreaks.length - 1]!;
      this.logProgress('Indexing CSV', completed, this.csvSize!);
    }
    appPrint(
      chalk.gray(
        emptyLines(1) +
          `Indexing Records:   At  ${new Date().toISOString()} ` +
          emptyLines(3)
      ),
      {removePreviousLines: 1}
    );
    appPrint(emptyLines(1));
    this.logProgress('Syncing Data', this.uploaded, this.csvSize);
    const {byteBreaks} = ICsvIndex;
    let promises = [];
    for (let i = 0; i < byteBreaks.length; i++) {
      const pageStart = byteBreaks[i]!;
      let pageEnd = undefined;
      if (byteBreaks[i + 1]) pageEnd = byteBreaks[i + 1];
      promises.push(this.createWriteWorker(pageStart, pageEnd, headers));
      if (promises.length === APP_WORKERS) {
        await Promise.all(promises);
        promises = [];
      }
    }
    if (promises.length !== APP_WORKERS) await Promise.all(promises);
    appPrint(
      chalk.gray(
        emptyLines(1) +
          `Syncing Data:   At  ${new Date().toISOString()} ` +
          emptyLines(3)
      ),
      {removePreviousLines: 1}
    );
  }

  private async indexCSVWorker(ICsvIndex: ICsvIndex, CHUNK_SIZE: number) {
    return new Promise<ICsvIndex>((resolve, reject) => {
      const {byteBreaks, lineBreaks} = ICsvIndex;
      const worker = new Worker(INDEX_CSV_WORKER, {
        workerData: {
          CHUNK_SIZE,
          CSV_PATH,
          byteBreaks,
          lineBreaks,
        },
      });
      worker.on('message', m => {
        lineBreaks.push(m.currentLine);
        byteBreaks.push(m.currentByte);
      });
      worker.on('exit', () => resolve({lineBreaks, byteBreaks}));
      worker.on('error', reject);
    });
  }

  async resetCollection() {
    const {MONGO_COLLECTION} = process.env;
    const replace = () =>
      this.database?.createCollection(`${MONGO_COLLECTION}`);
    return await this.database
      ?.dropCollection(`${MONGO_COLLECTION}`)
      .then(async () => {
        await replace();
        return;
      })
      .catch(async (error: unknown) => {
        // @ts-expect-error unknown typeof err
        if (!error || error.message === 'ns not found') await replace();
        return;
      });
  }

  private async createWriteWorker(
    pageStart: number,
    pageEnd: number | undefined,
    headers: string[]
  ) {
    return new Promise<void>((resolve, reject) => {
      const worker = new Worker(WRITE_GROUP_WORKER, {
        workerData: {
          headers,
          CSV_PATH,
          pageStart,
          pageEnd,
        },
        env: process.env,
      });

      worker.on('message', m => {
        if (m.completed) {
          this.uploaded = m.completed + this.uploaded;
          this.logProgress('Syncing Data', this.uploaded, this.csvSize);
        }
      });
      worker.on('exit', resolve);
      worker.on('error', reject);
    });
  }

  private async getCSVHeader() {
    return new Promise<string[]>((resolve, reject) => {
      let headerRow: string[] = [];
      fs.createReadStream(CSV_PATH)
        .pipe(csvParser({separator: ','}))
        .on('headers', headers => {
          headerRow = headers;
          resolve(headerRow);
        })
        .on('error', error => {
          reject(error);
        });
    });
  }

  private async getCSVSize() {
    return new Promise<number>((resolve, reject) => {
      let count = 0;
      const stream = fs.createReadStream(CSV_PATH);
      stream.on(
        'data',
        val => (count += val.toString().split('\n').length - 1)
      );
      stream.on('end', () => resolve(count));
      stream.on('error', error => reject(error));
    });
  }

  private logProgress(title: string, completed: number, total?: number) {
    const percentCompleted = Math.floor((completed / total!) * 100);
    this.printOnce(
      chalk.white('    ') +
        chalk.green(`${title}:      `) +
        chalk.bgGreen('   ' + percentCompleted + '%   ') +
        chalk.white('    ') +
        `(${completed}/${total})`
    );
  }
}
