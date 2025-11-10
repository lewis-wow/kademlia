import { Node } from './Node.js';
import repl from 'node:repl';
import { createContactFromAddress, sha1 } from './utils.js';
import { render } from 'prettyjson';

export class Repl {
  private readonly node: Node;

  constructor(opts: { node: Node }) {
    this.node = opts.node;
  }

  private _log(prefix: string, obj: object): void {
    console.log(render({ [prefix]: obj }));
  }

  start(): void {
    const replServer = repl.start({
      ignoreUndefined: true,
      prompt: `kademlia-node ${this.node.self.ip}:${this.node.self.port}> `,
    });

    replServer.context.start = this._start.bind(this);
    replServer.context.stop = this._stop.bind(this);
    replServer.context.lookup = this._lookup.bind(this);
    replServer.context.store = this._store.bind(this);
    replServer.context.get = this._get.bind(this);
    replServer.context.bootstrap = this._bootstrap.bind(this);
    replServer.context.ping = this._ping.bind(this);
    replServer.context.storage = this._storage.bind(this);
    replServer.context.contacts = this._contacts.bind(this);
    replServer.context.forceRepublish = this._forceRepublish.bind(this);

    replServer.context.clear = this._clear.bind(this);
  }

  private _start(): void {
    this.node.listen().then(() => {
      this._log('Listen', {
        self: this.node.self,
        address: `${this.node.self.ip}:${this.node.self.port}`,
      });
    });
  }

  private _stop(): void {
    this.node.shutdown();

    this._log('Stop', {
      self: this.node.self,
      address: `${this.node.self.ip}:${this.node.self.port}`,
    });
  }

  private _lookup(targetId: string): void {
    this.node.iterativeFindNode(targetId).then((contacts) => {
      this._log('Find node', {
        contacts,
      });
    });
  }

  private _forceRepublish(): void {
    this.node.storage.forceRepublish().then(() => {
      this._log('Force republish', { status: 'complete' });
    });
  }

  private _store(key: string | number, value: string): void {
    const hexKey = sha1(key.toString());

    this.node.iterativeStore(hexKey, value).then(() => {
      this._log('Store', {
        key,
        value,
      });
    });
  }

  private _get(key: string | number): void {
    const hexKey = sha1(key.toString());

    const localValue = this.node.storage.get(hexKey);
    if (localValue !== null) {
      this._log('Get', {
        local: true,
        keyHash: hexKey,
        key,
        value: localValue,
      });

      return;
    }

    this.node.iterativeFindValue(hexKey).then(({ value }) => {
      this._log('Get', {
        local: false,
        keyHash: hexKey,
        key,
        value,
      });
    });
  }

  private _bootstrap(address: string): void {
    const contact = createContactFromAddress(address);

    this.node.bootstrap(contact).then(() => {
      this._log('Bootstrap', {
        contact,
      });
    });
  }

  private _contacts(): void {
    const contacts = this.node.routingTable.getAllContacts();

    this._log('Contacts', {
      contacts,
    });
  }

  private _ping(address: string): void {
    const contact = createContactFromAddress(address);

    this.node.ping(createContactFromAddress(address)).then((value) => {
      this._log('Ping', {
        contact,
        pong: value,
      });
    });
  }

  private _storage(key?: string | number): void {
    if (key === undefined) {
      this._log('Storage', {
        original: this.node.storage.getOriginalContents(),
        replica: this.node.storage.getReplicaContents(),
      });
      return;
    }

    const hexKey = sha1(key.toString());

    this._log('Storage (Replica)', {
      [key]: this.node.storage.get(hexKey) ?? null,
    });
  }

  private _clear(): void {
    console.clear();
  }
}
