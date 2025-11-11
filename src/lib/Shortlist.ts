import { Contact, NodeId } from './types.js';
import { xorDistance } from './xorDistance.js';

type LookupContact = {
  contact: Contact;
  distance: bigint;
  queried: boolean;
};

export class Shortlist {
  private readonly targetId: NodeId;
  private readonly self: Contact;

  private readonly nodes = new Map<NodeId, LookupContact>();

  constructor(opts: { targetId: NodeId; self: Contact }) {
    this.targetId = opts.targetId;
    this.self = opts.self;
  }

  /**
   * Adds contact to shortlist.
   * Return true if the contact is new.
   */
  public add(contact: Contact): boolean {
    // Ignore self
    if (contact.nodeId === this.self.nodeId) {
      return false;
    }

    // Ignore if we already know the contact
    if (this.nodes.has(contact.nodeId)) {
      return false;
    }

    const distance = xorDistance(contact.nodeId, this.targetId);

    this.nodes.set(contact.nodeId, {
      contact: contact,
      distance: distance,
      queried: false,
    });

    return true;
  }

  /**
   * Adds list of contacts to shortlist.
   * Returns true if at least one of the contacts is new.
   */
  public addMany(contacts: Contact[]): boolean {
    let newNodesFound = false;

    for (const contact of contacts) {
      if (this.add(contact)) {
        newNodesFound = true;
      }
    }

    return newNodesFound;
  }

  /**
   * Returns 'count' of nearest nodes, for which we did not query yet.
   */
  public getNodesToQuery(count: number): Contact[] {
    const sorted = this._getSortedList();

    const nodesToQuery: Contact[] = [];

    for (const node of sorted) {
      if (nodesToQuery.length >= count) {
        break; // We have enaugh nodes to query
      }

      if (!node.queried) {
        nodesToQuery.push(node.contact);
      }
    }

    return nodesToQuery;
  }

  /**
   * Marks node as queried.
   */
  public markAsQueried(contact: Contact): void {
    const node = this.nodes.get(contact.nodeId);

    if (node) {
      node.queried = true;
    }
  }

  /**
   * Returns final 'k' sorted nearest contacts from whole shortlist.
   */
  public getFinalResults(count: number): Contact[] {
    return this._getSortedList()
      .slice(0, count)
      .map((n) => n.contact);
  }

  /**
   * Returns sorted list of all nodes.
   */
  private _getSortedList(): LookupContact[] {
    return Array.from(this.nodes.values()).sort((a, b) =>
      this._compareNodes(a, b),
    );
  }

  private _compareNodes(a: LookupContact, b: LookupContact): number {
    if (a.distance < b.distance) return -1;
    if (a.distance > b.distance) return 1;
    return 0;
  }
}
