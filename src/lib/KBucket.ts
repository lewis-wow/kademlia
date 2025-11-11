import { Contact } from './dto/ContactSchema.js';
import { Key } from './types.js';

export type KBucketOptions = {
  kBucketSize: number;
  rangeFrom: bigint;
  rangeTo: bigint;
};

export class KBucket {
  private readonly kBucketSize: number;
  private contacts: Contact[] = [];
  readonly rangeFrom: bigint;
  readonly rangeTo: bigint;

  constructor(opts: KBucketOptions) {
    this.kBucketSize = opts.kBucketSize;
    this.rangeFrom = opts.rangeFrom;
    this.rangeTo = opts.rangeTo;
  }

  split(): { leftBucket: KBucket; rightBucket: KBucket } {
    const midpoint = (this.rangeFrom + this.rangeTo) / BigInt(2);

    const leftBucket = new KBucket({
      kBucketSize: this.kBucketSize,
      rangeFrom: this.rangeFrom,
      rangeTo: midpoint,
    });

    const rightBucket = new KBucket({
      kBucketSize: this.kBucketSize,
      rangeFrom: midpoint,
      rangeTo: this.rangeTo,
    });

    // Reassign contacts to the new buckets
    for (const contact of this.contacts) {
      if (contact.nodeId <= midpoint) {
        leftBucket.add(contact);
      } else {
        rightBucket.add(contact);
      }
    }

    return { leftBucket, rightBucket };
  }

  add(contact: Contact): boolean {
    const existingIndex = this.contacts.findIndex(
      (c) => c.nodeId === contact.nodeId,
    );

    if (existingIndex !== -1) {
      const existing = this.contacts.splice(existingIndex, 1)[0];
      this.contacts.push(existing);
      return true;
    }

    if (this.contacts.length < this.kBucketSize) {
      this.contacts.push(contact);
      return true;
    }

    return false;
  }

  getContacts(): Contact[] {
    return [...this.contacts];
  }

  inRange(nodeId: Key): boolean {
    return nodeId >= this.rangeFrom && nodeId < this.rangeTo;
  }
}
