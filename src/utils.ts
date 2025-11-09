import { createHash } from 'node:crypto';
import { Contact } from './types.js';
import { render } from 'prettyjson';

export const xorDistance = (nodeIdA: string, nodeIdB: string): bigint => {
  const selfBigInt = BigInt('0x' + nodeIdA);
  const contactBigInt = BigInt('0x' + nodeIdB);

  const distance = selfBigInt ^ contactBigInt;

  return distance;
};

export const sha1 = (value: string): string =>
  createHash('sha1').update(value).digest('hex');

export const log = (prefix: string, obj: object): void => {
  console.log(`[${prefix}]`, render(obj));
};

export const createContactFromAddress = (
  address: string | { ip: string; port: number },
): Contact => {
  let ip: string;
  let port: number;

  if (typeof address === 'string') {
    const [ipRaw, portRaw] = address.split(':');
    ip = ipRaw;
    port = Number.parseInt(portRaw);
  } else {
    ip = address.ip;
    port = address.port;
  }

  const nodeId = sha1(`${ip}:${port}`);

  return {
    nodeId,
    ip,
    port,
  };
};
