const r = require('rethinkdb');
const config = require('../../config.json').db;

function checkDb(conn) {
  return new Promise(function(resolve, reject) {
    r.dbList().run(conn, function(err, result) {
      if (err) {
        reject(err);
        return;
      }

      if (result.indexOf(config.db) !== -1) {
        console.log(`-> ${config.db} exists`);
        resolve();
      } else {
        console.log(`-> creating ${config.db}`);
        r.dbCreate(config.db).run(conn, function(err, result) {
          if (err) {
            reject(Error(err));
            return;
          }
          console.log(`-> created ${config.db}`);
          resolve();
        });
      }
    });
  });
}

function checkTables(conn) {
  const tableCount = 2;
  const tables = {
    'palen': {
      'primary_key': 'id'
    },
    'status': {
      'primary_key': 'datum'
    }
  }
  return new Promise(function(resolve, reject) {
    const db = r.db(config.db);
    db.tableList().run(conn, function(err, result) {
      if (err) {
        reject(Error(err));
        return;
      }

      let numCreated = 0;

      for(var tableName in tables) {
        if (result.indexOf(tableName) !== -1) {
          console.log(`-> ${tableName} exists`);
          numCreated++;
        } else {
          db.tableCreate(tableName, tables[tableName]).run(conn, function(err) {
            if (err) {
              reject(Error(err));
              return;
            }

            console.log(`-> ${tableName} created`);

            numCreated++;
            if (numCreated === tableCount) {
              resolve();
            }
          })
        }
      }

      resolve();
    });
  });
}

async function setupdb() {
  const conn = await r.connect(config);
  console.log('Connection opened');

  // Database.
  console.log(`Checking for database ${config.db}`);
  await checkDb(conn);

  // Tables.
  console.log(`Checking for tables in ${config.db}`);
  await checkTables(conn);

  await conn.close();
  console.log('Connection closed');
}

setupdb();
