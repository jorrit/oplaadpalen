const r = require('rethinkdb');
const config = require('../../config.json');

async function getoplaadpalen() {
  const url = `http://oplaadpalen.nl/api/chargingpoints/${config.oplaadpalen.key}/json?box=${config.oplaadpalen.box.bottomleft},${config.oplaadpalen.box.topright}`;

  const conn = await r.connect(config.db);
  console.log('Connection opened');
  const table = await r.db(config.db.db).table('palen');

  let apiPalen = await r.http(url).run(conn);
  apiPalen = await apiPalen.toArray();

  // Insert + Update
  for(let i = 0; i < apiPalen.length; i++) {
    const apiPaal = apiPalen[i];
    apiPaal.id = parseInt(apiPaal.id, 10);
    apiPaal.nroutlets = parseInt(apiPaal.nroutlets, 10);
    console.log(`Paal ${apiPaal.id}: ${apiPaal.address}`);
    const dbPaal = await table.get(apiPaal.id).run(conn);
    if (dbPaal === null) {
      await table.insert(apiPaal).run(conn);
      console.log(`-> Toegevoegd!`);
    } else {
      const result = await table.get(apiPaal.id).update(apiPaal).run(conn);
      if (result.unchanged === 1) {
        console.log(`-> Zelfde!`);
      } else if(result.replaced) {
        console.log(`-> Vervangen!`);
      }
    }
  }

  // Delete
  const apiIds = await apiPalen.map(x => parseInt(x.id, 10));
  let dbPalenObsolete = await table.filter(p => r.expr(apiIds).contains(p('id')).not()).run(conn);
  dbPalenObsolete = await dbPalenObsolete.toArray();
  for(let i = 0; i < dbPalenObsolete.length; i++) {
    const dbPaalObsolete = dbPalenObsolete[i];
    console.log(`Paal ${dbPaalObsolete.id}: ${dbPaalObsolete.address}`);
    const result = await table.get(dbPaalObsolete.id).delete().run(conn);
    console.log(`-> Verwijderd :( !`);
    // FIXME: data verwijderen!
  };

  await table.sync().run(conn);

  await conn.close();
  console.log('Connection closed');
}

getoplaadpalen().catch(function(e) {
  console.log(e);
});
