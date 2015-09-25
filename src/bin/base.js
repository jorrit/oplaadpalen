/* eslint-disable no-console */
import program from 'commander';
import chalk from 'chalk';
import pkg from '../../package.json';
const config = require('../../config.json');
const r = require('rethinkdb');

export function log(str) {
  if (program.quiet) {
    return;
  }
  console.log(str);
}

export function error(str) {
  console.error(chalk.red(str));
}

program
  .version(pkg.version)
  .usage('[options]')
  .option('-q, --quiet', 'Only output errors', false);

export { program as program };

export function run(f) {
  program.parse(process.argv);

  let connection = null;

  r.connect(config.db).then(function(conn) {
    log(chalk.gray('Connection opened'));
    connection = conn;
    return f(conn);
  }).then(function() {
    connection.close({noreplyWait: true});
    log(chalk.grey('Connection closed'));
    process.exit(0);
  }).catch(function(e) {
    error(e);
    connection.close({noreplyWait: true});
    log(chalk.grey('Connection closed'));
    process.exit(1);
  });
}
