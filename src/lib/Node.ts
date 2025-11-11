import { RoutingTable } from './RoutingTable.js';
import { serve, ServerType } from '@hono/node-server';
import { Shortlist } from './Shortlist.js';
import { Storage } from './Storage.js';
import { ALPHA, K_BUCKET_SIZE } from './consts.js';
import { Contact } from './dto/ContactSchema.js';
import type { FindValueResponse } from './dto/RpcPayloadSchema.js';
import { Key } from './types.js';
import { Protocol } from './Protocol.js';

export type NodeOptions = {
  self: Contact;
  routingTable: RoutingTable;
  protocol: Protocol;
  storage: Storage;
};

export class Node {
  httpServer?: ServerType;
  readonly routingTable: RoutingTable;
  readonly protocol: Protocol;
  readonly storage: Storage;
  readonly self: Contact;

  constructor(opts: NodeOptions) {
    this.self = opts.self;
    this.routingTable = opts.routingTable;
    this.protocol = opts.protocol;
    this.storage = opts.storage;
  }

  listen(): Promise<ServerType> {
    return new Promise<ServerType>((resolve) => {
      const server = serve(
        {
          fetch: this.protocol.fetch,
          hostname: this.self.ip,
          port: this.self.port,
        },
        () => {
          this.storage.start();
          this.httpServer = server;

          resolve(server);
        },
      );
    });
  }

  public shutdown(): void {
    this.storage.stop();
    this.httpServer?.close();
  }

  public async iterativeFindNode(targetId: Key): Promise<Contact[]> {
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
        this.protocol.findNode(contact, targetId),
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

    return finalNodes;
  }

  async _doIterativeStore(key: Key, value: string): Promise<void> {
    // 1. Find the k-closest nodes
    const closestNodes = await this.iterativeFindNode(key);

    if (closestNodes.length === 0) {
      return;
    }

    // 2. Send a STORE command to all of them
    const storePromises = closestNodes.map((contact) =>
      this.protocol.store(contact, key, value),
    );

    await Promise.allSettled(storePromises);
  }

  public async iterativeStore(key: Key, value: string): Promise<void> {
    // Tell the storage module this is "original" data
    // This will save it to originalStorage AND replicaStorage
    this.storage.setOriginal(key, value);

    // Run the network logic
    await this._doIterativeStore(key, value);
  }

  public async iterativeFindValue(
    key: Key,
  ): Promise<{ value: string | null; nodes: Contact[] }> {
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
        this.protocol.findValue(contact, key),
      );

      const responses = await Promise.allSettled(rpcPromises);
      let newNodesFound = false;

      // 6. Process responses
      for (const res of responses) {
        if (res.status === 'fulfilled' && res.value) {
          const response: FindValueResponse | null = res.value;

          // 6a. SUCCESS: We found the value!
          if (response?.found) {
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

    const finalNodes = shortlist.getFinalResults(K_BUCKET_SIZE);
    return { value: null, nodes: finalNodes };
  }

  public async bootstrap(bootstrapContact: Contact): Promise<void> {
    if (bootstrapContact.nodeId === this.self.nodeId) {
      console.warn('Cannot bootstrap against self contact.');
      return;
    }

    this.routingTable.addContact(bootstrapContact);

    // Self lookup
    // This way we fill our k-buckets and notify our presence in network.
    await this.iterativeFindNode(this.self.nodeId);
  }
}
