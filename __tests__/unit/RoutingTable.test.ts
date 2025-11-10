import { describe, it, expect, beforeEach } from 'vitest';
import { RoutingTable } from '../../src/lib/RoutingTable.js';
import { Contact } from '../../src/lib/types.js';
import { ID_BITS, K_BUCKET_SIZE } from '../../src/consts.js';
import { sha1 } from '../../src/utils.js';

const createContact = (id: string): Contact => ({
  nodeId: sha1(id),
  ip: '127.0.0.1',
  port: parseInt(id, 16),
});

describe('RoutingTable', () => {
  const selfContact = createContact('self');
  let routingTable: RoutingTable;

  beforeEach(() => {
    routingTable = new RoutingTable({ self: selfContact });
  });

  it('should be initialized with the correct number of buckets', () => {
    // @ts-expect-error private property
    expect(routingTable.buckets.length).toBe(ID_BITS);
  });

  it('should not add self to the routing table', () => {
    routingTable.addContact(selfContact);
    expect(routingTable.getAllContacts()).toEqual([]);
  });

  it('should add a new contact', () => {
    const contact1 = createContact('contact1');
    routingTable.addContact(contact1);
    expect(routingTable.getAllContacts()).toEqual([contact1]);
  });

  it('should not add the same contact twice', () => {
    const contact1 = createContact('contact1');
    routingTable.addContact(contact1);
    routingTable.addContact(contact1);
    expect(routingTable.getAllContacts().length).toBe(1);
  });

  it('should find the closest contacts', () => {
    const contacts = Array.from({ length: 10 }, (_, i) =>
      createContact(`contact${i}`),
    );
    contacts.forEach((c) => routingTable.addContact(c));

    const targetId = sha1('target');
    const closest = routingTable.findClosest(targetId, 5);

    expect(closest.length).toBe(5);

    // A simple check to ensure the returned contacts are somewhat sorted by distance
    // A more rigorous test would calculate XOR distances and assert sorting.
    const firstDistance =
      BigInt('0x' + closest[0].nodeId) ^ BigInt('0x' + targetId);
    const lastDistance =
      BigInt('0x' + closest[4].nodeId) ^ BigInt('0x' + targetId);
    expect(firstDistance < lastDistance).toBe(true);
  });

  it('should return all contacts', () => {
    const contact1 = createContact('contact1');
    const contact2 = createContact('contact2');
    routingTable.addContact(contact1);
    routingTable.addContact(contact2);
    const allContacts = routingTable.getAllContacts();
    expect(allContacts).toContainEqual(contact1);
    expect(allContacts).toContainEqual(contact2);
    expect(allContacts.length).toBe(2);
  });

  it('should find closest with a default count', () => {
    const contacts = Array.from({ length: 10 }, (_, i) =>
      createContact(`contact${i}`),
    );
    contacts.forEach((c) => routingTable.addContact(c));
    const closest = routingTable.findClosest(sha1('target'));
    expect(closest.length).toBe(K_BUCKET_SIZE);
  });
});
