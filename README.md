# Portfolio Value Calculator CLI

A command-line program that calculates the latest portfolio value for each token in USD by processing a CSV file of transaction logs. The portfolio value is calculated by summing up the deposits and subtracting the withdrawals for each token. The program also enables users to retrieve the portfolio value for a specific token or on a specific date by passing in additional parameters.

##### Sample Video

- Change the playback speed to x2 the application takes 2:24 minutes to pasre the csv sample using 8 workers reading 5mb at a time

https://user-images.githubusercontent.com/46242846/218307176-3dc099ba-e8c4-4ffa-84cf-160ebb505cc4.mp4



### Getting started

```shell
git clone --depth=1 https://github.com/Mugambi-Ian/propine-engineering-interview
cd propine-engineering-interview
npm install
```

Then, you can run locally in development mode with live reload:

```shell
npm run dev
```

## Solution

The application optimizes performance by dividing the `CSV_file` into manageable chunks and processing each chunk in a separate worker thread. The `indexCSVWorker` uses the `fs` library to break down the file based on the `CHUNK_SIZE` defined by the user. As the worker reads each chunk, it sends a message to the main thread indicating the end position of the chunk in the file. The main thread then calculates the start position for the next chunk and continues the process until the entire file is indexed. The main thread then launches a specified number of `writeGroup` workers at a time. These workers use the `csv-parser` library to parse the chunks  and store the values in a `MongoDB` collection. This goes on until the whole file is parsed. The portfolio value is calculated by executing aggregate queries on the `MongoDB` collection.

### Additional Features

- Progress Tracking
- Cached Query Results

### File Structure
- `app/index.ts`: The main program file that handles the calculation of the portfolio value.

- `utils/inquirer.ts`: Contains functions that interact with the user, such as `askToProceed()`, `getPortfolioRequest()`, and `getWorkersAndChunkSize()`.

- `handlers/transactions.ts`: Contains the `getPortfolioResponse()` function that calculates the portfolio value based on the transactions in the database.

- `service/transactions.ts`: Contains the `TransactionService` class that includes functions to load the database, check the synchronization of records, migrate the records, and run the `indexCSVWorker` and `createWriteWorker`.

- `workers/indexCSV.js`: A worker that receives worker data containing the `CSVIndex`, `CSV_FILE_PATH`, and `CHUNK_SIZE`. It opens a ReadStream at the `CSV_FILE_PATH` and starts reading the specified `CHUNK_SIZE` from the last element in `CsvIndex.byteBreaks`. The worker returns an updated `CSV_INDEX.byteBreaks` with the new last element as the sum of the last element and the data size returned from the `ReadStream`.

- `workers/writeGroup.js`: A worker that receives worker data containing the `CSV_FILE_PATH`, `pageStart`, and `pageEnd`. It establishes a connection to `MongoDB`, opens a ReadStream starting at `pageStart` and ending at `pageEnd`, parses the data using `csvParser`, and inserts the valid results into a `MongoDB` collection.


### Functionality

When the application runs, it performs the following actions:

1. Initializes a `TransactionService` instance, `service`.

2. Loads the database using `service.loadDB()`

3. Clears the terminal and displays the program title and verifies the synchronization of records by calling `service.checkRecordSync()`, comparing `CSV_RECORDS_COUNT` to the `DATABASE_COLLECTION_COUNT`. If synced, goes to step 4. If not, goes to step 6.

4. Asks the user if they want to proceed with `askToProceed()`. If they choose to proceed, go to step 5. If not, exit the application.

5. Obtains user input with `getPortfolioRequest()`. If the user requests portfolio data, `getPortfolioResponse()` is executed and the result is printed. The process then returns to step 4. If the user requests synchronization of the CSV and database it returns to step 3. If the input is invalid it repeats this step.

6. Gets user input with `getWorkersAndChunkSize()` to determine the `CHUNK_SIZE` and `APP_WORKERS`, which are then passed to step 7.

7. Executes `service.migrateRecords(APP_WORKERS, CHUNK_SIZE)`, a promise function that:
    - Resets the database collection
    - Spawns a worker to read the `CSV_PATH` in chunks determined by `CHUNK_SIZE` and returns the total number of records and bytes processed. This information is stored in a `CSVIndex` indicating the start and end (line and byte) of each chunk in the `CSV_FILE`.
    - Spawns X(`APP_WORKERS`) workers at a time to read values from the `CSV_FILE` at unique `start` and `end` positions determined by the `CSVIndex`. Each read is equal to `CHUNK_SIZE`. The workers then write the values to the database. Once all promises are resolved, return to step 4.


### Extras

I used a boilerplate I had earlier created for this project [NodeJS CLI App Boilerplate](https://github.com/Mugambi-Ian/NodeJS-CLI-App-Boilerplate---TypeScript). I ended upusing it to create tetris for CLI with it [Terminal Tetris](https://github.com/Mugambi-Ian/terminal-tetris)
