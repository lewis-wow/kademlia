import { createHash } from 'node:crypto';
import { Contact } from './types.js';
import { ID_BITS } from './consts.js';

export const xorDistance = (nodeIdA: string, nodeIdB: string): bigint => {
  const selfBigInt = BigInt('0x' + nodeIdA);
  const contactBigInt = BigInt('0x' + nodeIdB);

  const distance = selfBigInt ^ contactBigInt;

  return distance;
};

export const hash = (value: string): string => {
  const hash = createHash('sha256').update(value).digest('hex');
  const bigIntHash = BigInt(`0x${hash}`);

  const result = bigIntHash % BigInt(ID_BITS);

  return result.toString(16);
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

  const nodeId = hash(`${ip}:${port}`);

  return {
    nodeId,
    ip,
    port,
  };
};
