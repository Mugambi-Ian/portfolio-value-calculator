import {workerData, parentPort} from 'worker_threads';
import {createReadStream} from 'fs';

const {byteBreaks, lineBreaks, CSV_PATH, CHUNK_SIZE} = workerData;

let byteStart = byteBreaks[byteBreaks.length - 1];
if (byteStart === -1) byteStart = 0;

const csvData = createReadStream(CSV_PATH, {
  start: byteStart,
  encoding: 'utf-8',
  highWaterMark: 1024 * 1024 * (CHUNK_SIZE < 1 ? 1 : CHUNK_SIZE),
});

csvData.once('data', async row => {
  while (row.slice(-1) !== '\n') {
    row = row.slice(0, -1);
  }
  const currentLine =
    row.split('\n').length - 1 + lineBreaks[lineBreaks.length - 1];
  const currentByte =
    Buffer.byteLength(row) + byteBreaks[byteBreaks.length - 1];
  parentPort.postMessage({currentByte, currentLine});
  csvData.close();
  parentPort.close();
});
