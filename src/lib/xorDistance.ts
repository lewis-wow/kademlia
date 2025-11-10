export const xorDistance = (nodeIdA: string, nodeIdB: string): bigint => {
  const selfBigInt = BigInt('0x' + nodeIdA);
  const contactBigInt = BigInt('0x' + nodeIdB);

  const distance = selfBigInt ^ contactBigInt;

  return distance;
};
