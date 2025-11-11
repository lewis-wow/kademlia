import { createHash } from 'node:crypto';
import type { Contact } from './lib/types.js';
import { ID_BITS } from './lib/consts.js';

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
