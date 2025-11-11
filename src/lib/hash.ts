import { createHash } from 'node:crypto';
import { ID_BITS } from './consts.js';

export const hash = (value: string): bigint => {
  const hash = createHash('sha256').update(value).digest('hex');
  const bigIntHash = BigInt(`0x${hash}`);

  const result = bigIntHash % BigInt(ID_BITS);

  return result;
};
