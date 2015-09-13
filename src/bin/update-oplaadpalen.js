#!/usr/bin/env babel-node

const r = require('rethinkdb');
const config = require('../../config.json');
const chalk = require('chalk');
import { log, run } from './base.js';

let conn;

async function updateoplaadpalen() {
  const url = `http://oplaadpalen.nl/api/chargingpoints/${config.oplaadpalen.key}/json?box=${config.oplaadpalen.box.bottomleft},${config.oplaadpalen.box.topright}`;

  conn = await r.connect(config.db);
  log(chalk.grey('Connection opened'));
  const table = await r.db(config.db.db).table('palen');

  let apiPalen = await r.http(url).run(conn);
  apiPalen = await apiPalen.toArray();

  // Insert + Update
  for(let i = 0; i < apiPalen.length; i++) {
    const apiPaal = apiPalen[i];
    apiPaal.id = parseInt(apiPaal.id, 10);
    apiPaal.nroutlets = parseInt(apiPaal.nroutlets, 10);
    log(`Paal ${apiPaal.id}: ${apiPaal.address}`);
    const dbPaal = await table.get(apiPaal.id).run(conn);
    if (dbPaal === null) {
      await table.insert(apiPaal).run(conn);
      log(chalk.green(`-> Toegevoegd!`));
    } else {
      const result = await table.get(apiPaal.id).update(apiPaal).run(conn);
      if (result.unchanged === 1) {
        log(`-> Zelfde!`);
      } else if(result.replaced) {
        log(`-> Vervangen!`);
        log(`Nieuw:`);
        log(apiPaal);
        log(`Oud:`);
        log(dbPaal);
      }
    }
  }

  // Delete
  const apiIds = await apiPalen.map(x => parseInt(x.id, 10));
  let dbPalenObsolete = await table.filter(p => r.expr(apiIds).contains(p('id')).not()).run(conn);
  dbPalenObsolete = await dbPalenObsolete.toArray();
  for(let i = 0; i < dbPalenObsolete.length; i++) {
    const dbPaalObsolete = dbPalenObsolete[i];
    log(`Paal ${dbPaalObsolete.id}: ${dbPaalObsolete.address}`);
    await table.get(dbPaalObsolete.id).delete().run(conn);
    log(chalk.cyan(`-> Verwijderd :( !`));
    // FIXME: data verwijderen!
  }

  await table.sync().run(conn);

  await conn.close();
  log(chalk.grey('Connection closed'));
}

run(updateoplaadpalen, conn);
