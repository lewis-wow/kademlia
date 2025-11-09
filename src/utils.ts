import { createHash } from 'node:crypto';

export const xorDistance = (nodeIdA: string, nodeIdB: string): bigint => {
  const selfBigInt = BigInt('0x' + nodeIdA);
  const contactBigInt = BigInt('0x' + nodeIdB);

  const distance = selfBigInt ^ contactBigInt;

  return distance;
};

export const sha1 = (value: string): string =>
  createHash('sha1').update(value).digest('hex');
