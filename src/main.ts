#!/usr/bin/env tsx
import { Node } from './lib/Node.js';
import getPort from 'get-port';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Repl } from './Repl.js';
import {
  ALPHA,
  DATA_EXPIRATION_MS,
  ID_BITS,
  K_BUCKET_SIZE,
  REPUBLISH_INTERVAL_MS,
} from './lib/consts.js';
import { createContactFromAddress } from './utils.js';

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

const node = new Node({
  self,
  config: {
    alpha: ALPHA,
    kBucketSize: K_BUCKET_SIZE,
    idBits: ID_BITS,
    republishIntervalMs: REPUBLISH_INTERVAL_MS,
    dataExpirationMs: DATA_EXPIRATION_MS,
  },
});

const repl = new Repl({ node });
repl.start();
