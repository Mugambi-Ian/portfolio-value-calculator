import {IPortfolioResponse} from '../models/Portfolio.js'; /* eslint-disable @typescript-eslint/no-explicit-any */
import {Db, Document} from 'mongodb';
import axios from 'axios';
import {printUSD} from '../utils/index.js';

async function getExchangeRate(symbol: string): Promise<number> {
  const {CRYPTOCOMPARE_API_KEY} = process.env;
  const response = await axios.get(
    `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD&nextBytePage=${CRYPTOCOMPARE_API_KEY}`
  );
  return response.data.USD;
}
export async function getPortfolioResponse(
  db: Db,
  token?: string,
  timestamp?: string
): Promise<IPortfolioResponse> {
  const {MONGO_COLLECTION} = process.env;
  const transactionsCollection = db.collection(`${MONGO_COLLECTION}`);
  let query: Document = {};
  const matchExpression: any = {};

  if (token) matchExpression.token = token;

  query = !timestamp
    ? getAllQuery(matchExpression)
    : getWithTimeStampQuery(matchExpression, timestamp);

  const portfolio = await transactionsCollection.aggregate(query).toArray();

  const exchangeRates = await Promise.all(
    portfolio.map<Promise<IPortfolioResponse>>(async ({_id, total}) => {
      const rate = await getExchangeRate(_id);
      return {
        [_id]: {
          portfoliValue: total ? printUSD(total * rate) : undefined,
          tokenBalance: total,
          exchangeRate: printUSD(rate),
        },
      };
    })
  );

  return exchangeRates.reduce((result, current) => {
    const symbol = Object.keys(current)[0] as string;
    result[symbol] = current[symbol]!;
    return result;
  }, {});
}

function getAllQuery(matchExpression: any) {
  return [
    {$match: matchExpression},
    {
      $group: {
        _id: '$token',
        total: {
          $sum: {
            $cond: {
              if: {$eq: ['$transaction_type', 'DEPOSIT']},
              then: '$amount',
              else: {$multiply: ['$amount', -1]},
            },
          },
        },
      },
    },
  ];
}

function getWithTimeStampQuery(matchExpression: any, date: string) {
  return [
    {
      $match: {
        ...matchExpression,
        timestamp: {
          $gte: new Date(date),
          $lt: new Date(date + 'T23:59:59.999Z'),
        },
      },
    },
    {
      $group: {
        _id: '$token',
        total: {
          $sum: {
            $cond: {
              if: {$eq: ['$transaction_type', 'DEPOSIT']},
              then: '$amount',
              else: {$multiply: ['$amount', -1]},
            },
          },
        },
      },
    },
  ];
}
