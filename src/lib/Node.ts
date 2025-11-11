import { Hono } from 'hono';
import { RoutingTable } from './RoutingTable.js';
import { Contact, NodeId, RpcPayload } from './types.js';
import { serve, ServerType } from '@hono/node-server';
import { Shortlist } from './Shortlist.js';
import { render } from 'prettyjson';
import { Storage } from './Storage.js';
import { K_BUCKET_SIZE } from './consts.js';
import { sValidator } from '@hono/standard-validator';
import {
  ContactSchema,
  RpcPayloadSchema,
  StringToBigIntSchema,
} from './schemas.js';
import z from 'zod';

const PingPayloadSchema = RpcPayloadSchema.extend({});
const PingResponseSchema = ContactSchema.extend({});

const StorePayloadSchema = RpcPayloadSchema.extend({
  key: StringToBigIntSchema,
  value: z.string(),
});
const StoreResponseSchema = z.object({
  ok: z.boolean(),
});

export const FindNodePayloadSchema = RpcPayloadSchema.extend({
  targetId: StringToBigIntSchema,
});
const FindNodeResponseSchema = z.array(ContactSchema);

export const FindValuePayloadSchema = RpcPayloadSchema.extend({
  key: StringToBigIntSchema,
});
const FindValueResponseSchema = z.union([
  z.object({
    value: z.string(),
    found: z.literal(true),
  }),
  z.object({
    nodes: z.array(ContactSchema),
    found: z.literal(false),
  }),
]);

export type NodeConfig = {
  alpha: number;
  kBucketSize: number;
  idBits: number;
  dataExpirationMs: number;
  republishIntervalMs: number;
};

export type NodeOptions = {
  config: NodeConfig;
  self: Contact;
};

export class Node {
  private readonly config: NodeConfig;
  private readonly app = new Hono();
  httpServer?: ServerType;
  readonly self: Contact;
  readonly routingTable: RoutingTable;
  readonly storage: Storage;

  private _debug(prefix: string, obj: object): void {
    if (process.env.DEBUG) {
      console.debug(render({ [prefix]: obj }));
    }
  }

  constructor(opts: NodeOptions) {
    this.self = opts.self;
    this.config = opts.config;

    this.routingTable = new RoutingTable({
      self: this.self,
    });

    this.storage = new Storage({
      config: {
        dataExpirationMs: this.config.dataExpirationMs,
        republishIntervalMs: this.config.republishIntervalMs,
      },
      republishCallback: this._doIterativeStore.bind(this),
    });

    this.app.post(
      '/ping',
      sValidator('json', PingPayloadSchema),
      async (ctx) => {
        const { senderContact } = ctx.req.valid('json');

        this.routingTable.addContact(senderContact);
        this._debug('Ping', { senderContact });

        // Return self contact so the sender can store this node to his routing table
        return ctx.json(PingResponseSchema.encode(this.self));
      },
    );

    this.app.post(
      '/store',
      sValidator('json', StorePayloadSchema),
      async (ctx) => {
        const { senderContact, key, value } = ctx.req.valid('json');

        this.routingTable.addContact(senderContact);
        this._debug('Store', { senderContact, key, value });

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
        this._debug('Find node', { senderContact, targetId });

        const closest = this.routingTable.findClosest(
          BigInt(targetId),
          K_BUCKET_SIZE,
        );

        return ctx.json(FindNodeResponseSchema.encode(closest));
      },
    );

    this.app.post(
      '/find-value',
      sValidator('json', FindValuePayloadSchema),
      async (ctx) => {
        const { senderContact, key } = ctx.req.valid('json');

        this.routingTable.addContact(senderContact);
        this._debug('Find value', { senderContact, key });

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

  listen(): Promise<ServerType> {
    return new Promise<ServerType>((resolve) => {
      const server = serve(
        {
          fetch: this.app.fetch,
          hostname: this.self.ip,
          port: this.self.port,
        },
        () => {
          this.storage.start();
          this.httpServer = server;

          this._debug('Listen', {
            self: this.self,
            address: `${this.self.ip}:${this.self.port}`,
          });

          resolve(server);
        },
      );
    });
  }

  public shutdown(): void {
    this.storage.stop();
    this.httpServer?.close();

    this._debug('Shutdown', { status: 'complete' });
  }

  private async _sendRequest<T>(
    contact: Contact,
    endpoint: string,
    body: object,
  ): Promise<T | null> {
    const url = `http://${contact.ip}:${contact.port}${endpoint}`;
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
    const payload = PingPayloadSchema.encode({
      senderContact: this.self,
    });

    const response = PingResponseSchema.parse(
      await this._sendRequest(contact, '/ping', payload),
    );

    return response !== null;
  }

  async store(contact: Contact, key: NodeId, value: string): Promise<boolean> {
    const payload = StorePayloadSchema.encode({
      senderContact: this.self,
      key,
      value,
    });

    const response = StoreResponseSchema.parse(
      await this._sendRequest(contact, '/store', payload),
    );

    return response?.ok === true;
  }

  async findNode(contact: Contact, targetId: NodeId): Promise<Contact[]> {
    const payload = FindNodePayloadSchema.encode({
      senderContact: this.self,
      targetId,
    });

    const response = FindNodeResponseSchema.parse(
      await this._sendRequest(contact, '/find-node', payload),
    );

    return response ?? [];
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async findValue(contact: Contact, key: NodeId) {
    const payload = FindValuePayloadSchema.encode({
      senderContact: this.self,
      key,
    });

    const response = FindValueResponseSchema.parse(
      await this._sendRequest(contact, '/find-value', payload),
    );

    return response;
  }

  public async iterativeFindNode(targetId: NodeId): Promise<Contact[]> {
    this._debug('IterativeFindNode', { targetId });

    const shortlist = new Shortlist({ targetId, self: this.self });
    const initialContacts = this.routingTable.findClosest(
      targetId,
      this.config.kBucketSize,
    );
    shortlist.addMany(initialContacts);

    let loop = 0; // Loop protection
    while (loop++ < 20) {
      // 2. Get ALPHA closest, unqueried nodes from the shortlist
      const nodesToQuery = shortlist.getNodesToQuery(this.config.alpha);

      // 3. Stop condition: No one left to ask
      if (nodesToQuery.length === 0) {
        break;
      }

      // 4. Mark them as queried
      nodesToQuery.forEach((contact) => shortlist.markAsQueried(contact));

      // 5. Send RPCs in parallel
      const rpcPromises = nodesToQuery.map((contact) =>
        this.findNode(contact, targetId),
      );

      const responses = await Promise.allSettled(rpcPromises);
      let newNodesFound = false;

      // 6. Process responses
      for (const res of responses) {
        if (res.status === 'fulfilled' && res.value) {
          const newContacts: Contact[] = res.value;
          // addMany returns true if any new nodes were actually added
          if (shortlist.addMany(newContacts)) {
            newNodesFound = true;
          }
        }
      }

      // 7. Stop condition: Convergence
      // (We queried nodes but didn't find anyone new/closer)
      if (!newNodesFound) {
        break;
      }
    }

    // 8. Loop finished, return the K-closest from the list
    const finalNodes = shortlist.getFinalResults(this.config.kBucketSize);
    this._debug('IterativeFindNode', {
      nodesCount: finalNodes.length,
      status: 'found',
    });

    return finalNodes;
  }

  private async _doIterativeStore(key: NodeId, value: string): Promise<void> {
    // 1. Find the k-closest nodes
    const closestNodes = await this.iterativeFindNode(key);

    if (closestNodes.length === 0) {
      this._debug('IterativeStore', {
        warning: `Found no nodes to store data on for key ${key}.`,
      });
      return;
    }

    this._debug('IterativeStore', {
      nodesCount: closestNodes.length,
      status: 'storing',
    });

    // 2. Send a STORE command to all of them
    const storePromises = closestNodes.map((contact) =>
      this.store(contact, key, value),
    );

    await Promise.allSettled(storePromises);
  }

  public async iterativeStore(key: string, value: string): Promise<void> {
    this._debug('IterativeStore', { key, publisher: 'self' });

    // Tell the storage module this is "original" data
    // This will save it to originalStorage AND replicaStorage
    this.storage.setOriginal(key, value);

    // Run the network logic
    await this._doIterativeStore(key, value);

    this._debug('IterativeStore', { key, status: 'finished' });
  }

  public async iterativeFindValue(
    key: string,
  ): Promise<{ value: string | null; nodes: Contact[] }> {
    this._debug('IterativeFindValue', { key });

    // 1. Initialize the Shortlist
    const shortlist = new Shortlist({ targetId: key, self: this.self });
    const initialContacts = this.routingTable.findClosest(
      key,
      this.config.kBucketSize,
    );
    shortlist.addMany(initialContacts);

    this._debug('IterativeFindValue', { initialContacts });

    let loop = 0;
    while (loop++ < 20) {
      // 2. Get nodes to query
      const nodesToQuery = shortlist.getNodesToQuery(this.config.alpha);

      // 3. Stop condition: No one left
      if (nodesToQuery.length === 0) {
        break;
      }

      // 4. Mark as queried
      nodesToQuery.forEach((contact) => shortlist.markAsQueried(contact));

      // 5. Send RPCs in parallel (this time, findValue)
      const rpcPromises = nodesToQuery.map((contact) =>
        this.findValue(contact, key),
      );

      const responses = await Promise.allSettled(rpcPromises);
      let newNodesFound = false;

      // 6. Process responses
      for (const res of responses) {
        if (res.status === 'fulfilled' && res.value) {
          const response: FindValueResponse | null = res.value;

          // 6a. SUCCESS: We found the value!
          if (response?.found) {
            this._debug('IterativeFindValue', {
              key,
              value: response.value,
              status: 'found',
            });

            return { value: response.value, nodes: [] };
          }

          // 6b. We didn't find the value, but got new nodes
          if (response?.found === false) {
            if (shortlist.addMany(response.nodes)) {
              newNodesFound = true;
            }
          }
          // (If response is null, the request failed, we just ignore it)
        }
      }

      // 7. Stop condition: Convergence
      if (!newNodesFound) {
        break;
      }
    }

    // 8. Loop finished without finding the value.
    this._debug('IterativeFindValue', {
      key,
      status: 'not found',
    });

    const finalNodes = shortlist.getFinalResults(this.config.kBucketSize);
    return { value: null, nodes: finalNodes };
  }

  public async bootstrap(bootstrapContact: Contact): Promise<void> {
    if (bootstrapContact.nodeId === this.self.nodeId) {
      console.warn('Cannot bootstrap against self contact.');
      return;
    }

    this._debug('Bootstrap', {
      bootstrap: bootstrapContact,
    });

    this.routingTable.addContact(bootstrapContact);

    // Self lookup
    // This way we fill our k-buckets and notify our presence in network.
    await this.iterativeFindNode(this.self.nodeId);
  }
}
