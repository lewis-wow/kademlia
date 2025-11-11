import { NodeId } from './types.js';

export const xorDistance = (nodeIdA: NodeId, nodeIdB: NodeId): bigint => {
  const distance = nodeIdA ^ nodeIdB;

  return distance;
};
