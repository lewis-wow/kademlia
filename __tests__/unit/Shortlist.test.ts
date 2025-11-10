import { describe, it, expect, beforeEach } from 'vitest';
import { Shortlist } from '../../src/Shortlist.js';
import { Contact } from '../../src/types.js';
import { sha1 } from '../../src/utils.js';

const createContact = (id: string): Contact => ({
  nodeId: sha1(id),
  ip: '127.0.0.1',
  port: parseInt(id, 16),
});

describe('Shortlist', () => {
  let shortlist: Shortlist;
  const selfContact = createContact('self');
  const targetId = sha1('target');

  beforeEach(() => {
    shortlist = new Shortlist({ self: selfContact, targetId });
  });

  it('should not add self to the shortlist', () => {
    const result = shortlist.add(selfContact);
    expect(result).toBe(false);
    expect(shortlist.getFinalResults(1)).toEqual([]);
  });

  it('should add a new contact', () => {
    const contact1 = createContact('contact1');
    const result = shortlist.add(contact1);
    expect(result).toBe(true);
    expect(shortlist.getFinalResults(1)).toEqual([contact1]);
  });

  it('should not add the same contact twice', () => {
    const contact1 = createContact('contact1');
    shortlist.add(contact1);
    const result = shortlist.add(contact1);
    expect(result).toBe(false);
    expect(shortlist.getFinalResults(2).length).toBe(1);
  });

  it('should add many contacts', () => {
    const contacts = [createContact('c1'), createContact('c2')];
    const result = shortlist.addMany(contacts);
    expect(result).toBe(true);
    expect(shortlist.getFinalResults(2).length).toBe(2);
  });

  it('should return false when adding many existing contacts', () => {
    const contact1 = createContact('c1');
    shortlist.add(contact1);
    const result = shortlist.addMany([contact1]);
    expect(result).toBe(false);
  });

  it('should get nodes to query', () => {
    const contacts = [
      createContact('c1'),
      createContact('c2'),
      createContact('c3'),
    ];
    shortlist.addMany(contacts);
    const nodesToQuery = shortlist.getNodesToQuery(2);
    expect(nodesToQuery.length).toBe(2);
  });

  it('should mark a node as queried', () => {
    const contact1 = createContact('c1');
    shortlist.add(contact1);

    let nodesToQuery = shortlist.getNodesToQuery(1);
    expect(nodesToQuery).toEqual([contact1]);

    shortlist.markAsQueried(contact1);

    nodesToQuery = shortlist.getNodesToQuery(1);
    expect(nodesToQuery).toEqual([]);
  });

  it('should return final results, sorted by distance', () => {
    // These are added in an unsorted order
    const contactFar = createContact('ffff');
    const contactNear = createContact('0000');
    const contactMid = createContact('8888');

    shortlist.addMany([contactFar, contactNear, contactMid]);

    const finalResults = shortlist.getFinalResults(3);

    // We need to calculate the expected order
    const expectedOrder = [contactNear, contactMid, contactFar].sort((a, b) => {
      const distA = BigInt('0x' + a.nodeId) ^ BigInt('0x' + targetId);
      const distB = BigInt('0x' + b.nodeId) ^ BigInt('0x' + targetId);
      return distA < distB ? -1 : 1;
    });

    expect(finalResults).toEqual(expectedOrder);
  });
});
