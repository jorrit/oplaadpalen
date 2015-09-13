#!/usr/bin/env babel-node

const r = require('rethinkdb');
const config = require('../../config.json').db;
const chalk = require('chalk');
import { log, run } from './base.js';

let conn;

// TODO: Promises
async function checkDb() {
  const dbs = await r.dbList().run(conn);

  if (dbs.indexOf(config.db) === -1) {
    await r.dbCreate(config.db).run(conn);
    log(chalk.green(`-> ${config.db} created`));
  }
}

async function checkTables() {
  const tables = {
    'palen': {
      'primary_key': 'id',
    },
    'status': {
      'primary_key': 'datum',
    },
    'oplaadacties': {
      'primary_key': 'id',
    },
  };

  const db = r.db(config.db);
  const dbTables = await db.tableList().run(conn);

  for (const tableName in tables) {
    if (dbTables.indexOf(tableName) === -1) {
      await db.tableCreate(tableName, tables[tableName]).run(conn);
      log(chalk.green(`-> ${tableName} created`));
    }
  }
}

async function checkIndices() {
  const indices = {
    oplaadacties: {
      paal: true,
      start: true,
    },
  };

  const db = r.db(config.db);

  for (const tableName in indices) {
    const dbIndices = await db.table(tableName).indexList().run(conn);
    for (const indexName in indices[tableName]) {
      if (dbIndices.indexOf(indexName) !== -1) {
        continue;
      }

      const index = indices[tableName][indexName];
      if (index === true) {
        await db.table(tableName).indexCreate(indexName).run(conn);
      } else {
        await db.table(tableName).indexCreate(indexName, index).run(conn);
      }
      log(chalk.green(`-> ${tableName}.${indexName} created`));
    }
  }
}

async function setupdb() {
  conn = await r.connect(config);
  log(chalk.grey('Connection opened'));

  // Database.
  log(`Checking for database ${config.db}`);
  await checkDb();

  // Tables.
  log(`Checking for tables in ${config.db}`);
  await checkTables();

  // Indices.
  log(`Checking for indices in ${config.db}`);
  await checkIndices();

  await conn.close();
  log(chalk.grey('Connection closed'));
}

run(setupdb, conn);
