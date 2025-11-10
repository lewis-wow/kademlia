import { Contact } from './types.js';

export type KBucketConfig = {
  kBucketSize: number;
};

export type KBucketOptions = {
  config: KBucketConfig;
};

export class KBucket {
  private readonly config: KBucketConfig;
  private contacts: Contact[] = [];

  constructor(opts: KBucketOptions) {
    this.config = opts.config;
  }

  add(contact: Contact): void {
    const existingIndex = this.contacts.findIndex(
      (c) => c.nodeId === contact.nodeId,
    );

    if (existingIndex !== -1) {
      const existing = this.contacts.splice(existingIndex, 1)[0];
      this.contacts.push(existing);
      return;
    }

    if (this.contacts.length < this.config.kBucketSize) {
      this.contacts.push(contact);
      return;
    }

    // If the bucket is full and the contact is new
    // In a real Kademlia implementation, a "ping" mechanism would be used here.
    // The least-recently seen contact (this.contacts[0]) would be pinged.
    // If it responds, the new contact is ignored. If it doesn't respond, it's removed,
    // and the new contact is added.
    console.warn('Bucket is full, ignoring new contact.');
  }

  getContacts(): Contact[] {
    return [...this.contacts];
  }

  getContact(nodeId: string): Contact | undefined {
    return this.contacts.find((c) => c.nodeId === nodeId);
  }

  hasContact(nodeId: string): boolean {
    return !!this.getContact(nodeId);
  }
}
