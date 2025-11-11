import z from 'zod';
import { StringToBigIntSchema } from './StringToBigIntSchema.js';

export const ContactSchema = z.object({
  nodeId: StringToBigIntSchema,
  ip: z.ipv4(),
  port: z.int(),
});

export type Contact = z.infer<typeof ContactSchema>;
