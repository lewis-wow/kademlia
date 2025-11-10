import { Hono } from 'hono';
import { RoutingTable } from './RoutingTable.js';
import { Contact, RpcPayload } from './types.js';
import { serve, ServerType } from '@hono/node-server';
import { ALPHA, K_BUCKET_SIZE } from './consts.js';
import { Shortlist } from './Shortlist.js';
import { render } from 'prettyjson';

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
  readonly self: Contact;
  private readonly routingTable: RoutingTable;
  readonly storage = new Map<string, string>();

  private _debug(prefix: string, obj: object): void {
    if (process.env.DEBUG) {
      console.debug(render({ [prefix]: obj }));
    }
  }

  constructor(opts: { self: Contact }) {
    this.self = opts.self;

    this.routingTable = new RoutingTable({ self: this.self });

    this.app.post('/ping', async (ctx) => {
      const { senderContact } = await ctx.req.json<PingPayload>();

      this.routingTable.addContact(senderContact);
      this._debug('Ping', { senderContact });

      // Return self contact so the sender can store this node to his routing table
      return ctx.json(this.self);
    });

    this.app.post('/store', async (ctx) => {
      const { senderContact, key, value } = await ctx.req.json<StorePayload>();

      this.routingTable.addContact(senderContact);
      this._debug('Store', { senderContact, key, value });

      this.storage.set(key, value);

      return ctx.json({ ok: true });
    });

    this.app.post('/find-node', async (ctx) => {
      const { senderContact, targetId } = await ctx.req.json<FindNodePayload>();

      this.routingTable.addContact(senderContact);
      this._debug('Find node', { senderContact, targetId });

      const closest = this.routingTable.findClosest(targetId);

      return ctx.json(closest);
    });

    this.app.post('/find-value', async (ctx) => {
      const { senderContact, key } = await ctx.req.json<FindValuePayload>();

      this.routingTable.addContact(senderContact);
      this._debug('Find value', { senderContact, key });

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

  listen(): Promise<ServerType> {
    return new Promise<ServerType>((resolve) => {
      const server = serve(
        {
          fetch: this.app.fetch,
          hostname: this.self.ip,
          port: this.self.port,
        },
        () => {
          this._debug('Listen', {
            self: this.self,
            address: `${this.self.ip}:${this.self.port}`,
          });

          resolve(server);
        },
      );
    });
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

  public async iterativeFindNode(targetId: string): Promise<Contact[]> {
    this._debug('IterativeFindNode', { targetId });

    const shortlist = new Shortlist({ targetId, self: this.self });
    const initialContacts = this.routingTable.findClosest(
      targetId,
      K_BUCKET_SIZE,
    );
    shortlist.addMany(initialContacts);

    let loop = 0; // Loop protection
    while (loop++ < 20) {
      // 2. Get ALPHA closest, unqueried nodes from the shortlist
      const nodesToQuery = shortlist.getNodesToQuery(ALPHA);

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
    const finalNodes = shortlist.getFinalResults(K_BUCKET_SIZE);
    this._debug('IterativeFindNode', {
      nodesCount: finalNodes.length,
      status: 'found',
    });

    return finalNodes;
  }

  public async iterativeStore(key: string, value: string): Promise<void> {
    this._debug('IterativeStore', { key });

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

    this._debug('IterativeStore', { key, status: 'finished' });
  }

  public async iterativeFindValue(
    key: string,
  ): Promise<{ value: string | null; nodes: Contact[] }> {
    this._debug('IterativeFindValue', { key });

    // 1. Initialize the Shortlist
    const shortlist = new Shortlist({ targetId: key, self: this.self });
    const initialContacts = this.routingTable.findClosest(key, K_BUCKET_SIZE);
    shortlist.addMany(initialContacts);

    let loop = 0;
    while (loop++ < 20) {
      // 2. Get nodes to query
      const nodesToQuery = shortlist.getNodesToQuery(ALPHA);

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

    const finalNodes = shortlist.getFinalResults(K_BUCKET_SIZE);
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
