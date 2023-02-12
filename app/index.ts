import chalk from 'chalk';
// import inquirer from 'inquirer';
import {createSpinner} from 'nanospinner';
import {
  CHECK_SYNC_MSG,
  LOADER_MSG,
  MemoFunction,
  appClear,
  appPrint,
  emptyLines,
  objectToText,
  printTitle,
} from './utils/index.js';
import {
  askToProceed,
  getPortfolioRequest,
  getWorkersAndChuckSize,
} from './utils/inquirer.js';
import {TransactionService} from './service/transactions.js';
import {Db} from 'mongodb';
import {getPortfolioResponse} from './handlers/transactions.js';
import {config} from 'dotenv';

let appUI = {};
let db: Db;

const service = new TransactionService();
const memoFunctions = new MemoFunction();
const portfolioValue = memoFunctions.runOnce(getPortfolioResponse);

async function main() {
  appClear();
  appUI = appPrint(await printTitle());

  db = await service.loadDb();
  await checkSync();
  await askToProceed();
  await loadPortfolio();
}

async function checkSync() {
  appPrint(appUI, {clear: true});
  const spinner = createSpinner(CHECK_SYNC_MSG);
  appPrint(
    chalk.gray(
      emptyLines(2) +
        `  Check Sync: ${new Date().toISOString()}` +
        emptyLines(3)
    )
  );
  spinner.start();
  const synced = await service.checkRecordSync();
  spinner.stop();
  appPrint(
    chalk.gray(
      ` Sync ${synced}:   At  ${new Date().toISOString()}` + emptyLines(2)
    )
  );
  if (!synced) {
    memoFunctions.clearMemoFuncs();
    const {APP_WORKERS, CHUNK_SIZE} = await getWorkersAndChuckSize();
    return await service.migrateRecords(APP_WORKERS, CHUNK_SIZE);
  }
}

async function loadPortfolio() {
  appPrint(appUI, {clear: true});
  const spinner = createSpinner(LOADER_MSG);
  const x = await getPortfolioRequest();
  if (x.all || x.date || x.token) {
    spinner.start();
    const {date, token} = x;
    const portfolio = await portfolioValue(db, token, date);
    spinner.stop();
    let result = '';
    for (let i = 0; i < Object.keys(portfolio).length; i++) {
      const key = Object.keys(portfolio)[i];
      const value = objectToText(Object.values(portfolio)[i]);
      result +=
        (i === 0 ? emptyLines(2) + ' ' : emptyLines(1)) +
        chalk.bgYellow(`  ${key}  `) +
        chalk.yellow('  ' + value + emptyLines(2));
    }
    appPrint(result);
    await askToProceed();
    await loadPortfolio();
  } else if (x.sync) {
    await checkSync();
    await askToProceed();
    await loadPortfolio();
  } else await loadPortfolio();
}

try {
  config();
  main();
} catch (error) {
  appPrint(error);
}
