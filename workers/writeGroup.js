import {workerData, parentPort} from 'worker_threads';
import {createReadStream} from 'fs';
import csvParser from 'csv-parser';
import {MongoClient} from 'mongodb';

const {headers, CSV_PATH, pageEnd} = workerData;
let {pageStart} = workerData;

Array.prototype.toObject = function () {
  const newArr = [];
  for (let i = 0; i < this.length; i++) newArr.push(this[i], this[i]);
  const obj = {};
  for (let i = 0; i < newArr.length; i++) obj[i] = newArr[i];
  return obj;
};

async function Main() {
  const {MONGO_URI, MONGO_DATABASE, MONGO_COLLECTION} = process.env;
  const client = await MongoClient.connect(`${MONGO_URI}`);
  const database = client.db(MONGO_DATABASE);
  const collection = database.collection(`${MONGO_COLLECTION}`);
  await client.connect();
  const values = [];
  const csvRead = createReadStream(CSV_PATH, {
    start: pageStart === -1 ? 0 : pageStart,
    end: pageEnd,
    encoding: 'utf-8',
  });

  csvRead.pipe(csvParser({headers})).on('data', data => {
    if (pageStart !== -1) values.push(data);
    else pageStart = pageStart === -1 ? 0 : pageStart;
  });

  csvRead.on('end', async () => {
    let data = JSON.parse(JSON.stringify(values));
    data = data.filter(d => Object.keys(d).length === headers.length);
    data = data.map(value => ({
      ...value,
      timestamp: new Date(value.timestamp),
      amount: parseFloat(value.amount),
    }));
    if (data.length !== 0) await collection.insertMany(data);
    parentPort.postMessage({completed: data.length});
    parentPort.postMessage({success: true});
    await client.close();
    parentPort.close();
    csvRead.close();
  });
}

Main();
