import { Contact, NodeId } from './types.js';

export type KBucketConfig = {
  kBucketSize: number;
};

export type KBucketOptions = {
  config: KBucketConfig;
  rangeFrom: bigint;
  rangeTo: bigint;
};

export class KBucket {
  private readonly config: KBucketConfig;
  private contacts: Contact[] = [];
  readonly rangeFrom: bigint;
  readonly rangeTo: bigint;

  constructor(opts: KBucketOptions) {
    this.config = opts.config;
    this.rangeFrom = opts.rangeFrom;
    this.rangeTo = opts.rangeTo;
  }

  split(): { leftBucket: KBucket; rightBucket: KBucket } {
    const midpoint = (this.rangeFrom + this.rangeTo) / BigInt(2);

    const leftBucket = new KBucket({
      config: this.config,
      rangeFrom: this.rangeFrom,
      rangeTo: midpoint,
    });

    const rightBucket = new KBucket({
      config: this.config,
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

    if (this.contacts.length < this.config.kBucketSize) {
      this.contacts.push(contact);
      return true;
    }

    return false;
  }

  getContacts(): Contact[] {
    return [...this.contacts];
  }

  inRange(nodeId: NodeId): boolean {
    return nodeId >= this.rangeFrom && nodeId < this.rangeTo;
  }
}
