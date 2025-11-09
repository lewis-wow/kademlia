import { ServerType } from '@hono/node-server';
import { Node } from './Node.js';
import repl from 'node:repl';

export class Repl {
  private readonly node: Node;
  private nodeServer?: ServerType;

  constructor(opts: { node: Node }) {
    this.node = opts.node;
  }

  start(): void {
    const replServer = repl.start({
      ignoreUndefined: true,
      prompt: 'kademlia-node> ',
    });

    replServer.context.start = this._start.bind(this);
    replServer.context.stop = this._stop.bind(this);
    replServer.context.lookup = this._lookup.bind(this);
    replServer.context.store = this._store.bind(this);
    replServer.context.get = this._get.bind(this);
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

  private _store(key: string, value: string): void {
    void this.node.iterativeStore(key, value);
  }

  private _get(key: string): void {
    void this.node.iterativeFindValue(key);
  }
}
