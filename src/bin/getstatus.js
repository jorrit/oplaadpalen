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

  const apiStatus = await r.http(url).run(conn);
  const availability = await palen.outerJoin(apiStatus,
    (p, a) => a('id').coerceTo('number').eq(p('id'))).run(conn);

  // The promise is only needed because of
  // https://github.com/rethinkdb/rethinkdb/issues/4780
  await new Promise(function(resolve, reject) {
    availability.each(async (err, { left: paal, right: av }) => {
      if(err) reject(err);

      // TODO: als av leeg is: availability zonder paal. Warning!

      av.id = parseInt(av.id, 10);
      av.available = parseInt(av.available, 10);
      av.failure = parseInt(av.failure, 10);
      av.nroutlets = parseInt(av.nroutlets, 10);
      av.occupied = parseInt(av.occupied, 10);
      av.date = now;

      statussesToInsert.push(av);

      console.log(`${paal.address}: ${av.occupied}/${av.nroutlets}`);
      if (av.failure > 0) {
        console.log(`-> ${av.failure} defect!`);
      }

      if (!paal.currentOplaadActies) {
        paal.currentOplaadActies = [];
      }
      const currentOplaadActies = paal.currentOplaadActies;
      if (av.occupied > currentOplaadActies.length) {
        const started = av.occupied - currentOplaadActies.length;
        console.log(`-> ${started} started!`);
        for(let i = 0; i < started; i++) {
          const oplaadActie = {
            id: await r.uuid().run(conn),
            paal: paal.id,
            start: now,
            end: null,
          };
          console.log(oplaadActie);
          currentOplaadActies.push(oplaadActie);
          await oplaadacties.insert(oplaadActie).run(conn);
        }
        await palen.get(paal.id).update(paal).run(conn);
      }
      if (av.occupied < currentOplaadActies.length) {
        const stopped = currentOplaadActies.length - av.occupied;
        console.log(`-> ${stopped} stopped!`);
        // Remove each stopped actie.
        for(let i = 0; i < stopped; i++) {
          const toRemove = currentOplaadActies[0];
          currentOplaadActies.slice(0, 1); // TODO: test
          toRemove.end = now;
          await oplaadacties.get(toRemove.id).update(toRemove).run(conn);
        }
        // Save the paal.
        await palen.get(paal.id).update(paal).run(conn);
      }
    }, resolve);
  });

  // TODO: insert statussesToInsert.
  await conn.close();
  console.log('Connection closed');
}

getstatus().catch(function(e) {
  console.log(e);
  conn.close();
});
