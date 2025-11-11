import { describe, it, expect, beforeEach } from 'vitest';
import { KBucket } from '../../src/lib/KBucket.js';
import { Contact } from '../../src/lib/types.js';
import { K_BUCKET_SIZE } from '../../src/lib/consts.js';

describe('KBucket', () => {
  let kBucket: KBucket;
  const contact1: Contact = { nodeId: 'a', ip: '127.0.0.1', port: 1001 };
  const contact2: Contact = { nodeId: 'b', ip: '127.0.0.1', port: 1002 };
  const contact3: Contact = { nodeId: 'c', ip: '127.0.0.1', port: 1003 };

  beforeEach(() => {
    kBucket = new KBucket();
  });

  it('should add a new contact', () => {
    kBucket.add(contact1);
    expect(kBucket.getContacts()).toEqual([contact1]);
  });

  it('should not add the same contact twice', () => {
    kBucket.add(contact1);
    kBucket.add(contact1);
    expect(kBucket.getContacts()).toEqual([contact1]);
    expect(kBucket.getContacts().length).toBe(1);
  });

  it('should move an existing contact to the end of the list', () => {
    kBucket.add(contact1);
    kBucket.add(contact2);
    kBucket.add(contact1);
    expect(kBucket.getContacts()).toEqual([contact2, contact1]);
  });

  it('should not add a new contact when the bucket is full', () => {
    kBucket.add(contact1);
    kBucket.add(contact2);
    kBucket.add(contact3);
    expect(kBucket.getContacts()).toEqual([contact1, contact2]);
    expect(kBucket.getContacts().length).toBe(K_BUCKET_SIZE);
  });

  it('should return all contacts', () => {
    kBucket.add(contact1);
    kBucket.add(contact2);
    expect(kBucket.getContacts()).toEqual([contact1, contact2]);
  });

  it('should get a contact by nodeId', () => {
    kBucket.add(contact1);
    expect(kBucket.getContact('a')).toEqual(contact1);
    expect(kBucket.getContact('non-existent')).toBeUndefined();
  });

  it('should check if a contact exists', () => {
    kBucket.add(contact1);
    expect(kBucket.hasContact('a')).toBe(true);
    expect(kBucket.hasContact('non-existent')).toBe(false);
  });
});
