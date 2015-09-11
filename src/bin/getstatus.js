const r = require('rethinkdb');
const config = require('../../config.json');

let conn;

async function getstatus() {
  const url = `http://oplaadpalen.nl/api/availability/${config.oplaadpalen.key}/json`;

  conn = await r.connect(config.db);
  console.log('Connection opened');

  console.log('Fetching palen ...');
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
      console.log(`${paal.address}\n-> Geen status!`);
      return;
    }

    outputBuffer.push(`${paal.address}: ${av.occupied}/${av.nroutlets}`);

    if (av.failure > 0) {
      outputBuffer.push(`-> ${av.failure} defect!`);
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
        let toRemoveId = currentOplaadActies[0];
        currentOplaadActies = currentOplaadActies.slice(1);
        // Legacy.
        if (toRemoveId.id) {
          console.log('Legacy!');
          toRemoveId = toRemoveId.id;
        }
        await oplaadacties.get(toRemoveId).update({ end: now }).run(conn);
      }
      // Save the paal.
      await palen.get(paal.id).update({currentOplaadActies}).run(conn);
    }

    // Output.
    console.log(outputBuffer.join('\n'));
  }));

  if (statussesToInsert.length > 0) {
    await status.insert({
      datum: now,
      status: statussesToInsert,
    }).run(conn);
  }

  // TODO: insert statussesToInsert.
  await conn.close();
  console.log('Connection closed');
}

getstatus().catch(function(e) {
  console.log(e);
  conn.close();
});
