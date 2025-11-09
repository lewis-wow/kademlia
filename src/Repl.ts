import { ServerType } from '@hono/node-server';
import { Node } from './Node.js';
import repl from 'node:repl';
import { createContactFromAddress, sha1 } from './utils.js';
import { render } from 'prettyjson';

export class Repl {
  private readonly node: Node;
  private nodeServer?: ServerType;

  constructor(opts: { node: Node }) {
    this.node = opts.node;
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
    replServer.context.clear = this._clear.bind(this);
  }

  private _start(): void {
    this.node.listen().then((nodeServer) => {
      this.nodeServer = nodeServer;
    });
  }

  private _stop(): void {
    this.nodeServer?.close();
  }

  private _lookup(targetId: string): void {
    void this.node.iterativeFindNode(targetId);
  }

  private _store(key: string | number, value: string): void {
    void this.node.iterativeStore(sha1(key.toString()), value);
  }

  private _get(key: string | number): void {
    void this.node.iterativeFindValue(sha1(key.toString()));
  }

  private _bootstrap(address: string): void {
    void this.node.bootstrap(createContactFromAddress(address));
  }

  private _ping(address: string): void {
    void this.node.ping(createContactFromAddress(address));
  }

  private _storage(key?: string | number): void {
    if (key === undefined) {
      console.log(render({ storage: Object.fromEntries(this.node.storage) }));
      return;
    }

    console.log(
      render({ [key]: this.node.storage.get(sha1(key.toString())) ?? null }),
    );
  }

  private _clear(): void {
    console.clear();
  }
}
