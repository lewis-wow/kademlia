import { DATA_EXPIRATION_MS, REPUBLISH_INTERVAL_MS } from './consts.js';

export type RepublishCallback = (key: string, value: string) => Promise<void>;

export type StorageOptions = {
  republishCallback: RepublishCallback;
};

export class Storage {
  private readonly replicaStorage = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  private readonly republishCallback: RepublishCallback;
  private readonly originalStorage = new Map<string, string>();
  private interval: NodeJS.Timeout | null = null;

  constructor(opts: StorageOptions) {
    this.republishCallback = opts.republishCallback;
  }

  public setReplica(key: string, value: string): void {
    this.replicaStorage.set(key, {
      value: value,
      expiresAt: Date.now() + DATA_EXPIRATION_MS,
    });
  }

  public setOriginal(key: string, value: string): void {
    this.originalStorage.set(key, value);
    this.setReplica(key, value);
  }

  public get(key: string): string | null {
    const entry = this.replicaStorage.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.replicaStorage.delete(key);
      return null;
    }

    return entry.value;
  }

  public start(intervalMs = REPUBLISH_INTERVAL_MS): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      this._republishData();
      this._garbageCollect();
    }, intervalMs);

    this.interval.unref();
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  public async forceRepublish(): Promise<void> {
    await this._republishData();
  }

  public getReplicaContents(): object {
    return Object.fromEntries(this.replicaStorage);
  }

  public getOriginalContents(): object {
    return Object.fromEntries(this.originalStorage);
  }

  private async _republishData(): Promise<void> {
    const keyCount = this.originalStorage.size;
    if (keyCount === 0) {
      return;
    }

    const republishPromises = [];
    for (const [key, value] of this.originalStorage.entries()) {
      republishPromises.push(this.republishCallback(key, value));
    }

    await Promise.allSettled(republishPromises);
  }

  private _garbageCollect(): void {
    const now = Date.now();

    for (const [key, entry] of this.replicaStorage.entries()) {
      if (entry.expiresAt < now) {
        this.replicaStorage.delete(key);
      }
    }
  }
}
