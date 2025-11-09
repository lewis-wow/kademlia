export type NodeId = string;

export type Contact = {
  nodeId: NodeId;
  ipAddress: string;
  port: number;
  lastSeenTimestamp?: Date;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type RpcPayload<T = {}> = {
  senderContact: Contact;
} & T;
