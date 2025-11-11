import { Contact } from './dto/ContactSchema.js';
import { KBucket } from './KBucket.js';
import { Key } from './types.js';
import { xorDistance } from './xorDistance.js';

export type RoutingTableOptions = {
  self: Contact;
};

export class RoutingTable {
  private readonly self: Contact;
  private readonly buckets: KBucket[] = [];

  constructor(opts: RoutingTableOptions) {
    this.self = opts.self;
    this.buckets = [
      new KBucket({ rangeFrom: BigInt(0), rangeTo: BigInt(2) ** BigInt(160) }),
    ];
  }

  private _splitBucket(index: number): void {
    const { leftBucket, rightBucket } = this.buckets[index].split();
    this.buckets[index] = leftBucket;
    this.buckets.splice(index + 1, 0, rightBucket);
  }

  private _getBucketIndex(contact: Contact): number {
    for (let i = 0; i < this.buckets.length; i++) {
      const bucket = this.buckets[i];

      if (contact.nodeId < bucket.rangeTo) {
        return i;
      }
    }

    return -1;
  }

  addContact(contact: Contact): void {
    if (contact.nodeId === this.self.nodeId) {
      console.warn('Cannot add self to routing table.');
      return; // Do not add self
    }

    const index = this._getBucketIndex(contact);
    const bucket = this.buckets[index];

    if (bucket.add(contact)) {
      return;
    }

    if (bucket.inRange(this.self.nodeId)) {
      this._splitBucket(index);
      // Try adding the contact again after splitting
      this.addContact(contact);
    }
  }

  findClosest(targetId: Key, count: number): Contact[] {
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
