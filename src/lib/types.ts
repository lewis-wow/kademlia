export type NodeId = bigint;

export type Contact = {
  nodeId: NodeId;
  ip: string;
  port: number;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type RpcPayload<T = {}> = {
  senderContact: Contact;
} & T;
