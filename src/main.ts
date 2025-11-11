#!/usr/bin/env tsx
import { Node } from './lib/Node.js';
import getPort from 'get-port';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Repl } from './Repl.js';
import { createContactFromAddress } from './utils.js';
import { RoutingTable } from './lib/RoutingTable.js';
import { Protocol } from './lib/Protocol.js';
import { Storage } from './lib/Storage.js';

const SCRIPT_NAME = 'kademlia-node';

const argv = await yargs(hideBin(process.argv))
  .scriptName(SCRIPT_NAME)
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

const routingTable = new RoutingTable({
  self,
});

const storage = new Storage({
  republishCallback: async (key, value): Promise<void> => {
    await node._doIterativeStore(key, value);
  },
});

const protocol = new Protocol({
  routingTable,
  storage,
  self,
});

const node = new Node({
  self,
  routingTable,
  protocol,
  storage,
});

const repl = new Repl({ node });
repl.start();
