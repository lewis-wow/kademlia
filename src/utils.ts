import { Contact } from './lib/dto/ContactSchema.js';
import { hash } from './lib/hash.js';

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
