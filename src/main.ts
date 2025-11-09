#!/usr/bin/env tsx
import { Node } from './Node.js';
import { Contact } from './types.js';
import { sha1 } from './utils.js';
import getPort from 'get-port';

const selfRawId = process.argv[2];
const bootstrapArg = process.argv[3];

const self: Contact = {
  nodeId: sha1(selfRawId),
  ipAddress: '127.0.0.1',
  port: await getPort(),
};

console.log(`[INIT] Creating node...`);
console.log(`raw ID: ${selfRawId}`);
console.log(`Address: http://${self.ipAddress}:${self.port}`);

const node = new Node({ self });
await node.listen();

if (bootstrapArg) {
  const [rawNodeId, ipAddress = '127.0.0.1', portStr = '50822'] =
    bootstrapArg.split(':');

  if (!rawNodeId || !ipAddress || !portStr) {
    console.error('Invalid bootstrap argument format.');
    process.exit(1);
  }

  const bootstrapContact: Contact = {
    nodeId: sha1(rawNodeId),
    ipAddress,
    port: Number.parseInt(portStr),
  };

  console.log(`[INIT] Bootstrap against ${JSON.stringify(bootstrapContact)}`);

  await node.bootstrap(bootstrapContact);
}
