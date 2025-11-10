import { KBucket } from './KBucket.js';
import { Contact } from './types.js';
import { xorDistance } from './xorDistance.js';

export type RoutingTableConfig = {
  idBits: number;
  kBucketSize: number;
};

export type RoutingTableOptions = {
  config: RoutingTableConfig;
  self: Contact;
};

export class RoutingTable {
  private readonly self: Contact;
  private readonly config: RoutingTableConfig;
  private readonly buckets: KBucket[] = [];

  constructor(opts: RoutingTableOptions) {
    this.self = opts.self;
    this.config = opts.config;

    for (let i = 0; i < this.config.idBits; i++) {
      this.buckets.push(
        new KBucket({ config: { kBucketSize: this.config.kBucketSize } }),
      );
    }
  }

  private _getBucketIndex(newContact: Contact): number {
    const selfId = this.self.nodeId;
    const contactId = newContact.nodeId;

    // Do not store self contact
    if (selfId === contactId) {
      return -1;
    }

    const distance = xorDistance(selfId, contactId);

    // Bucket 'i' is for distance 'd' in range 2^i <= d < 2^(i+1).
    // Index 'i' is simply `floor(log2(d))`

    // The easiest way to calculate `floor(log2(d))` for a BigInt in JS is to
    // calculate the length of its binary representation.
    const binaryString = distance.toString(2);
    const index = binaryString.length - 1;

    return index;
  }

  addContact(contact: Contact): void {
    if (contact.nodeId === this.self.nodeId) {
      console.warn('Cannot add self to routing table.');
      return; // Do not add self
    }

    const index = this._getBucketIndex(contact);

    if (index < 0 || index > this.config.idBits) {
      console.warn(`Contact index (${index}) is out of allowed indexes.`);
      return;
    }

    this.buckets[index].add(contact);
  }

  findClosest(
    targetId: string,
    count: number = this.config.kBucketSize,
  ): Contact[] {
    const allContacts: Contact[] = [];
    this.buckets.forEach((bucket) => {
      allContacts.push(...bucket.getContacts());
    });

    // Sort all contacts by their distance to the target ID
    allContacts.sort((contactA, contactB) => {
      const distanceA = xorDistance(contactA.nodeId, targetId);
      const distanceB = xorDistance(contactB.nodeId, targetId);

      return Number(distanceA - distanceB);
    });

    return allContacts.slice(0, count);
  }

  getAllContacts(): Contact[] {
    const allContacts: Contact[] = [];
    this.buckets.forEach((bucket) => {
      allContacts.push(...bucket.getContacts());
    });
    return allContacts;
  }
}
