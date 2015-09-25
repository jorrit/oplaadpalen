#!/usr/bin/env babel-node

const r = require('rethinkdb');
const config = require('../../config.json');
import { log, error, run } from './base.js';

async function updatestatus(conn) {
  const url = `http://oplaadpalen.nl/api/availability/${config.oplaadpalen.key}/json`;

  log('Fetching palen ...');
  const now = new Date();
  const palen = r.db(config.db.db).table('palen');
  const status = r.db(config.db.db).table('status');
  const oplaadacties = r.db(config.db.db).table('oplaadacties');

  const statussesToInsert = [];

  // TODO: status ophalen via fetch()?
  let apiStatus = await r.http(url).run(conn);
  apiStatus = await apiStatus.toArray();
  apiStatus = apiStatus.map((av) => {
    av.id = parseInt(av.id, 10);
    av.available = parseInt(av.available, 10);
    av.failure = parseInt(av.failure, 10);
    av.nroutlets = parseInt(av.nroutlets, 10);
    av.occupied = parseInt(av.occupied, 10);
    return av;
  });

  let allPalen = await palen.run(conn);
  allPalen = await allPalen.toArray();

  // The promise is only needed because of
  // https://github.com/rethinkdb/rethinkdb/issues/4780
  await Promise.all(allPalen.map(async (paal) => {
    const av = apiStatus.find(s => s.id == paal.id);
    const outputBuffer = [];

    if (!paal.realtimestatus && !av) {
      return;
    }
    if (!av) {
      error(`${paal.address}\n-> Geen status!`);
      return;
    }

    outputBuffer.push(`${paal.address}: ${av.occupied}/${av.nroutlets}`);

    let fail = false;

    if (av.failure != (paal.currentFailure || 0)) {
      fail = true;
      outputBuffer.push(`-> ${av.failure} defect, was ${paal.currentFailure || 0}`);
      await palen.get(paal.id).update({currentFailure: av.failure}).run(conn);
    }

    statussesToInsert.push(av);

    let currentOplaadActies = paal.currentOplaadActies || [];
    // There are new charging cars.
    if (av.occupied > currentOplaadActies.length) {
      const started = av.occupied - currentOplaadActies.length;
      outputBuffer.push(`-> ${started} started!`);
      for(let i = 0; i < started; i++) {
        const oplaadActie = {
          paal: paal.id,
          start: now,
          end: null,
        };

        const result = await oplaadacties.insert(oplaadActie).run(conn);
        oplaadActie.id = result.generated_keys[0];
        currentOplaadActies.push(oplaadActie.id);
      }
      await palen.get(paal.id).update({currentOplaadActies}).run(conn);
    }
    // Some cars have left.
    if (av.occupied < currentOplaadActies.length) {
      const stopped = currentOplaadActies.length - av.occupied;
      outputBuffer.push(`-> ${stopped} stopped!`);
      // Remove each stopped actie.
      for(let i = 0; i < stopped; i++) {
        const toRemoveId = currentOplaadActies[0];
        currentOplaadActies = currentOplaadActies.slice(1);
        await oplaadacties.get(toRemoveId).update({ end: now }).run(conn);
      }
      // Save the paal.
      await palen.get(paal.id).update({currentOplaadActies}).run(conn);
    }

    // Output.
    if (fail) {
      error(outputBuffer.join('\n'));
    } else {
      log(outputBuffer.join('\n'));
    }
  }));

  // Insert statussesToInsert.
  if (statussesToInsert.length > 0) {
    await status.insert({
      datum: now,
      status: statussesToInsert,
    }).run(conn);
  }
}

run(updatestatus);
