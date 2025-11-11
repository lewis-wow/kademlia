import z from 'zod';
import { ContactSchema } from './ContactSchema.js';
import { StringToBigIntSchema } from './StringToBigIntSchema.js';

export const RpcPayloadSchema = z.object({
  senderContact: ContactSchema,
});

export const PingPayloadSchema = RpcPayloadSchema.extend({});
export type PingPayload = z.infer<typeof PingPayloadSchema>;
export const PingResponseSchema = ContactSchema.extend({});
export type PingResponse = z.infer<typeof PingResponseSchema>;

export const StorePayloadSchema = RpcPayloadSchema.extend({
  key: StringToBigIntSchema,
  value: z.string(),
});
export type StorePayload = z.infer<typeof StorePayloadSchema>;
export const StoreResponseSchema = z.object({
  ok: z.boolean(),
});
export type StoreResponse = z.infer<typeof StoreResponseSchema>;

export const FindNodePayloadSchema = RpcPayloadSchema.extend({
  targetId: StringToBigIntSchema,
});
export type FindNodePayload = z.infer<typeof FindNodePayloadSchema>;
export const FindNodeResponseSchema = z.array(ContactSchema);
export type FindNodeResponse = z.infer<typeof FindNodeResponseSchema>;

export const FindValuePayloadSchema = RpcPayloadSchema.extend({
  key: StringToBigIntSchema,
});
export type FindValuePayload = z.infer<typeof FindValuePayloadSchema>;
export const FindValueResponseSchema = z.union([
  z.object({
    value: z.string(),
    found: z.literal(true),
  }),
  z.object({
    nodes: z.array(ContactSchema),
    found: z.literal(false),
  }),
]);
export type FindValueResponse = z.infer<typeof FindValueResponseSchema>;
