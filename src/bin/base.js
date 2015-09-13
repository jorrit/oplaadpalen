/* eslint-disable no-console */
import program from 'commander';
import chalk from 'chalk';
import pkg from '../../package.json';

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

export function run(f, conn) {
  program.parse(process.argv);

  f().then(function() {
    process.exit(0);
  }).catch(function(e) {
    error(e);
    conn.close();
    process.exit(1);
  });
}
