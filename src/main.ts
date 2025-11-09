#!/usr/bin/env tsx
import { Node } from './Node.js';
import { createContactFromAddress } from './utils.js';
import getPort from 'get-port';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const SCRIPT_NAME = 'kademlia-node';

const argv = await yargs(hideBin(process.argv))
  .scriptName(SCRIPT_NAME)
  .option('bootstrap', {
    alias: 'b',
    describe: 'Optional bootstrap node contact (format: id:ip:port|ip:port)',
    type: 'string',
  })
  .option('ip', {
    describe: 'The IP address for this node to listen on',
    type: 'string',
    default: '127.0.0.1',
  })
  .option('port', {
    alias: 'p',
    describe:
      'The port for this node. If not specified, a random available port is used.',
    type: 'number',
  })
  .help()
  .alias('help', 'h').argv;

const self = createContactFromAddress({
  ip: argv.ip,
  port: argv.port ?? (await getPort()),
});

const node = new Node({ self });
await node.listen();

if (argv.bootstrap) {
  const bootstrap = createContactFromAddress(argv.bootstrap);
  await node.bootstrap(bootstrap);
}
