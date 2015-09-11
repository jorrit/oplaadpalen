const r = require('rethinkdb');
const config = require('../../config.json').db;

let conn;

// TODO: Promises
async function checkDb() {
  const dbs = await r.dbList().run(conn);

  if (dbs.indexOf(config.db) === -1) {
    await r.dbCreate(config.db).run(conn);
    console.log(`-> ${config.db} created`);
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
      console.log(`-> ${tableName} created`);
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
      console.log(`-> ${tableName}.${indexName} created`);
    }
  }
}

async function setupdb() {
  conn = await r.connect(config);
  console.log('Connection opened');

  // Database.
  console.log(`Checking for database ${config.db}`);
  await checkDb();

  // Tables.
  console.log(`Checking for tables in ${config.db}`);
  await checkTables();

  // Indices.
  console.log(`Checking for indices in ${config.db}`);
  await checkIndices();

  await conn.close();
  console.log('Connection closed');
}

setupdb().catch(function(e) {
  console.error(e);
  conn.close();
});
