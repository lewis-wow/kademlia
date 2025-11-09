import { createHash } from 'node:crypto';
import { Contact } from './types.js';
import { render } from 'prettyjson';
import { ID_BITS } from './consts.js';

export const xorDistance = (nodeIdA: string, nodeIdB: string): bigint => {
  const selfBigInt = BigInt('0x' + nodeIdA);
  const contactBigInt = BigInt('0x' + nodeIdB);

  const distance = selfBigInt ^ contactBigInt;

  return distance;
};

export const trimHexToLastBits = (hexString: string, n: number): string => {
  const num = BigInt('0x' + hexString.replace(/^0x/, ''));
  const mask = (1n << BigInt(n)) - 1n;

  const trimmedNum = num & mask;

  return trimmedNum.toString(16);
};

export const sha1 = (value: string): string =>
  trimHexToLastBits(createHash('sha1').update(value).digest('hex'), ID_BITS);

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
