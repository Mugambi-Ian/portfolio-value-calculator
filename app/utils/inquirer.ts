/* eslint-disable no-process-exit */
/* eslint-disable no-case-declarations */
import inquirer from 'inquirer';
import {appPrint, emptyLines} from './index.js';
import {IPortfolioRequest} from '../models/Portfolio.js';

export async function getPortfolioRequest(): Promise<IPortfolioRequest> {
  const {choice} = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: 'What information would you like to retrieve?',
      choices: optionsPrompt,
    },
  ]);

  switch (choice) {
    case 'latest_all':
      return {all: true};
    case 'latest_s':
      const t = await inquirer.prompt([tokenPrompt]);
      return {token: t.token};
    case 'date':
      const d = await inquirer.prompt([datePrompt]);
      return {date: d.date};
    case 'date_s':
      const {date, token} = await inquirer.prompt([datePrompt, tokenPrompt]);
      return {date, token};
    case 'sync':
      return {sync: true};
    default:
      return {};
  }
}

export async function askToProceed() {
  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: 'Would you like to proceed or exit the application?',
      choices: [
        {
          name: 'Proceed',
          value: 'proceed',
        },
        {
          name: 'Exit',
          value: 'exit',
        },
      ],
    },
  ]);

  if (answer.choice === 'exit') {
    appPrint(
      emptyLines(2) + ' Press CTRL+C' + emptyLines(2) + '🤗👋👋👋👋👋👋👋'
    );
    process.exit();
  } else return true;
}

export async function getWorkersAndChuckSize() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'APP_WORKERS',
      message: 'Enter the number of APP_WORKERS:',
      validate: (input: string) => {
        const value = parseInt(input, 10);
        if (!isNaN(value)) {
          return true;
        }
        return 'Please enter a valid number';
      },
    },
    {
      type: 'input',
      name: 'CHUNK_SIZE',
      message: 'Enter the CHUNK_SIZE in MB:',
      validate: (input: string) => {
        const value = parseInt(input, 10);
        if (!isNaN(value)) {
          return true;
        }
        return 'Please enter a valid number';
      },
    },
  ]);
  return {
    APP_WORKERS: parseInt(answers.APP_WORKERS, 10),
    CHUNK_SIZE: parseInt(answers.CHUNK_SIZE, 10),
  };
}

const optionsPrompt = [
  {
    name: 'The latest portfolio value per token in USD',
    value: 'latest_all',
  },
  {
    name: 'The latest portfolio value of `S` token in USD',
    value: 'latest_s',
  },
  {
    name: 'The portfolio value per token in USD on date `X`',
    value: 'date',
  },
  {
    name: 'The portfolio value of that token in USD on date X for token S',
    value: 'date_s',
  },
  {
    name: 'Sync CSV with database',
    value: 'sync',
  },
];

const datePrompt = {
  type: 'input',
  name: 'date',
  message: 'Enter Date (YYYY-MM-DD):',
  validate: (input: string) => /^\d{4}-\d{2}-\d{2}$/.test(input),
};
const tokenPrompt = {
  type: 'input',
  name: 'token',
  message: 'Enter Token Symbol :',
};
