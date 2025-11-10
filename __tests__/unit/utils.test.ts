import { describe, it, expect } from 'vitest';
import {
  xorDistance,
  createContactFromAddress,
  sha1,
} from '../../src/utils.js';

describe('utils', () => {
  describe('xorDistance', () => {
    it('should calculate the XOR distance between two node IDs', () => {
      const nodeIdA = 'a'.repeat(40); // 1010...
      const nodeIdB = '5'.repeat(40); // 0101...
      const expectedDistance = BigInt('0x' + 'f'.repeat(40)); // 1111...

      const distance = xorDistance(nodeIdA, nodeIdB);
      expect(distance).toBe(expectedDistance);
    });

    it('should return 0 for identical node IDs', () => {
      const nodeId = 'a'.repeat(40);
      const distance = xorDistance(nodeId, nodeId);
      expect(distance).toBe(BigInt(0));
    });
  });

  describe('createContactFromAddress', () => {
    it('should create a contact from a string address', () => {
      const address = '192.168.1.1:1234';
      const expectedNodeId = sha1(address);
      const contact = createContactFromAddress(address);

      expect(contact.ip).toBe('192.168.1.1');
      expect(contact.port).toBe(1234);
      expect(contact.nodeId).toBe(expectedNodeId);
    });

    it('should create a contact from an address object', () => {
      const address = { ip: '10.0.0.5', port: 5555 };
      const expectedNodeId = sha1(`${address.ip}:${address.port}`);
      const contact = createContactFromAddress(address);

      expect(contact.ip).toBe(address.ip);
      expect(contact.port).toBe(address.port);
      expect(contact.nodeId).toBe(expectedNodeId);
    });
  });
});
