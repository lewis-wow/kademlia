import { Hono } from 'hono';
import { RoutingTable } from './RoutingTable.js';
import { Storage } from './Storage.js';
import { K_BUCKET_SIZE } from './consts.js';
import { sValidator } from '@hono/standard-validator';
import { Contact } from './dto/ContactSchema.js';
import {
  FindNodePayloadSchema,
  FindNodeResponseSchema,
  FindValuePayloadSchema,
  type FindValueResponse,
  FindValueResponseSchema,
  PingPayloadSchema,
  PingResponseSchema,
  StorePayloadSchema,
  StoreResponseSchema,
} from './dto/RpcPayloadSchema.js';
import { Key } from './types.js';

export type ProtocolOptions = {
  self: Contact;
  routingTable: RoutingTable;
  storage: Storage;
};

export class Protocol {
  private readonly app = new Hono();
  readonly routingTable: RoutingTable;
  readonly storage: Storage;
  readonly self: Contact;

  constructor(opts: ProtocolOptions) {
    this.self = opts.self;
    this.routingTable = opts.routingTable;
    this.storage = opts.storage;

    this.app.post(
      '/ping',
      sValidator('json', PingPayloadSchema),
      async (ctx) => {
        const { senderContact } = ctx.req.valid('json');

        this.routingTable.addContact(senderContact);

        return ctx.json(PingResponseSchema.encode(this.self));
      },
    );

    this.app.post(
      '/store',
      sValidator('json', StorePayloadSchema),
      async (ctx) => {
        const { senderContact, key, value } = ctx.req.valid('json');

        this.routingTable.addContact(senderContact);
        this.storage.setReplica(key, value);

        return ctx.json(StoreResponseSchema.encode({ ok: true }));
      },
    );

    this.app.post(
      '/find-node',
      sValidator('json', FindNodePayloadSchema),
      async (ctx) => {
        const { senderContact, targetId } = ctx.req.valid('json');

        this.routingTable.addContact(senderContact);

        const closest = this.routingTable.findClosest(targetId, K_BUCKET_SIZE);

        return ctx.json(FindNodeResponseSchema.encode(closest));
      },
    );

    this.app.post(
      '/find-value',
      sValidator('json', FindValuePayloadSchema),
      async (ctx) => {
        const { senderContact, key } = ctx.req.valid('json');

        this.routingTable.addContact(senderContact);

        const value = this.storage.get(key);
        if (value === null) {
          const value = this.storage.get(key)!;

          return ctx.json(
            FindValueResponseSchema.encode({
              value: value,
              found: true,
            }),
          );
        }

        const closest = this.routingTable.findClosest(key, K_BUCKET_SIZE);

        return ctx.json(
          FindValueResponseSchema.encode({
            nodes: closest,
            found: false,
          }),
        );
      },
    );
  }

  fetch(): typeof this.app.fetch {
    return this.app.fetch;
  }

  private async _sendRequest<T>(opts: {
    contact: Contact;
    endpoint: string;
    payload: object;
  }): Promise<T | null> {
    const { contact, endpoint, payload } = opts;

    const url = `http://${contact.ip}:${contact.port}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2000),
      });

      if (!response.ok) {
        console.warn(`Request to ${url} failed with status ${response.status}`);
        return null;
      }

      // IMPORTANT: We have successfully communicated with them.
      // We are updating them in our routing table.
      this.routingTable.addContact(contact);

      return (await response.json()) as T;
    } catch (error) {
      console.error(
        `Failed to send request to ${url}:`,
        (error as Error).message,
      );

      // Here Kademlia usually removes or penalizes the node.
      // In our case, `addContact` will not refresh it, but
      // `KBucket` should ideally implement logic to remove
      // nodes that have not responded for a long time (which is beyond the scope of this example).
      return null;
    }
  }

  async ping(contact: Contact): Promise<boolean> {
    const payload = PingPayloadSchema.encode({
      senderContact: this.self,
    });

    const response = PingResponseSchema.parse(
      await this._sendRequest({ contact, endpoint: '/ping', payload }),
    );

    return response !== null;
  }

  async store(contact: Contact, key: Key, value: string): Promise<boolean> {
    const payload = StorePayloadSchema.encode({
      senderContact: this.self,
      key,
      value,
    });

    const response = StoreResponseSchema.parse(
      await this._sendRequest({ contact, endpoint: '/store', payload }),
    );

    return response?.ok === true;
  }

  async findNode(contact: Contact, targetId: Key): Promise<Contact[]> {
    const payload = FindNodePayloadSchema.encode({
      senderContact: this.self,
      targetId,
    });

    const response = FindNodeResponseSchema.parse(
      await this._sendRequest({ contact, endpoint: '/find-node', payload }),
    );

    return response ?? [];
  }

  async findValue(
    contact: Contact,
    key: Key,
  ): Promise<FindValueResponse | null> {
    const payload = FindValuePayloadSchema.encode({
      senderContact: this.self,
      key,
    });

    const response = FindValueResponseSchema.parse(
      await this._sendRequest({ contact, endpoint: '/find-value', payload }),
    );

    return response;
  }
}
