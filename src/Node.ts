import { Hono } from 'hono';
import { RoutingTable } from './RoutingTable.js';
import { Contact, RpcPayload } from './types.js';
import { serve } from '@hono/node-server';

export type PingPayload = RpcPayload;

export type StorePayload = RpcPayload<{
  key: string;
  value: string;
}>;

export type FindNodePayload = RpcPayload<{
  targetId: string;
}>;

export type FindValuePayload = RpcPayload<{
  key: string;
}>;

export type FindValueResponse =
  | { value: string; found: true }
  | { nodes: Contact[]; found: false };

export class Node {
  private readonly app = new Hono();
  private readonly self: Contact;
  private readonly routingTable: RoutingTable;
  private readonly storage = new Map<string, string>();

  constructor(opts: { self: Contact }) {
    this.self = opts.self;

    this.routingTable = new RoutingTable({ self: this.self });

    this.app.post('/ping', async (ctx) => {
      const { senderContact } = await ctx.req.json<PingPayload>();

      this.routingTable.addContact(senderContact);
      console.log(`Ping from ${JSON.stringify(senderContact)}`);

      // Return self contact so the sender can store this node to his routing table
      return ctx.json(this.self);
    });

    this.app.post('/store', async (ctx) => {
      const { senderContact, key, value } = await ctx.req.json<StorePayload>();

      this.routingTable.addContact(senderContact);
      console.log(`Store from ${JSON.stringify(senderContact)}`);

      this.storage.set(key, value);

      return ctx.json({ ok: true });
    });

    this.app.post('/find-node', async (ctx) => {
      const { senderContact, targetId } = await ctx.req.json<FindNodePayload>();

      this.routingTable.addContact(senderContact);
      console.log(`Find node from ${JSON.stringify(senderContact)}`);

      const closest = this.routingTable.findClosest(targetId);

      return ctx.json(closest);
    });

    this.app.post('/find-value', async (ctx) => {
      const { senderContact, key } = await ctx.req.json<FindValuePayload>();

      this.routingTable.addContact(senderContact);
      console.log(`Find value from ${JSON.stringify(senderContact)}`);

      if (this.storage.has(key)) {
        const value = this.storage.get(key)!;

        return ctx.json<FindValueResponse>({
          value: value,
          found: true,
        });
      }

      const closest = this.routingTable.findClosest(key);

      return ctx.json<FindValueResponse>({
        nodes: closest,
        found: false,
      });
    });
  }

  listen(): Promise<void> {
    return new Promise<void>((resolve) => {
      serve(
        {
          fetch: this.app.fetch,
          hostname: this.self.ipAddress,
          port: this.self.port,
        },
        () => {
          console.log(`Node ${JSON.stringify(this.self)} listening.`);
          resolve();
        },
      );
    });
  }

  private async _sendRequest<T>(
    contact: Contact,
    endpoint: string,
    body: object,
  ): Promise<T | null> {
    const url = `http://${contact.ipAddress}:${contact.port}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2000), // 2 seconds timeout
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
    const payload: PingPayload = {
      senderContact: this.self,
    };

    const response = await this._sendRequest<Contact>(
      contact,
      '/ping',
      payload,
    );

    return response !== null;
  }

  async store(contact: Contact, key: string, value: string): Promise<boolean> {
    const payload: StorePayload = {
      senderContact: this.self,
      key,
      value,
    };

    const response = await this._sendRequest<{ status: string }>(
      contact,
      '/store',
      payload,
    );

    return response?.status === 'ok';
  }

  async findNode(contact: Contact, targetId: string): Promise<Contact[]> {
    const payload: FindNodePayload = { senderContact: this.self, targetId };

    const response = await this._sendRequest<Contact[]>(
      contact,
      '/find-node',
      payload,
    );

    return response ?? [];
  }

  async findValue(
    contact: Contact,
    key: string,
  ): Promise<FindValueResponse | null> {
    const payload: FindValuePayload = { senderContact: this.self, key };

    const response = await this._sendRequest<FindValueResponse>(
      contact,
      '/find-value',
      payload,
    );

    return response;
  }
}
