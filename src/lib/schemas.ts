import z from 'zod';

export const StringToBigIntSchema = z.codec(z.string(), z.bigint(), {
  decode: (str) => BigInt(str),
  encode: (bigint) => bigint.toString(),
});

export const ContactSchema = z.object({
  nodeId: StringToBigIntSchema,
  ip: z.ipv4(),
  port: z.int(),
});

export const RpcPayloadSchema = z.object({
  senderContact: ContactSchema,
});
