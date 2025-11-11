import { Key } from './types.js';

export const xorDistance = (nodeIdA: Key, nodeIdB: Key): bigint => {
  const distance = nodeIdA ^ nodeIdB;

  return distance;
};
