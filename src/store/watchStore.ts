import { EventWatch, StoreState } from '../types';
import { readJsonFile, writeJsonFile } from '../lib/fs';

export class WatchStore {
  public constructor(private readonly filePath: string) {}

  public async list(): Promise<EventWatch[]> {
    const state = await this.readState();
    return state.watches.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public async getById(id: string): Promise<EventWatch | undefined> {
    const watches = await this.list();
    return watches.find((watch) => watch.id === id);
  }

  public async upsert(watch: EventWatch): Promise<void> {
    const state = await this.readState();
    const index = state.watches.findIndex((existingWatch) => existingWatch.id === watch.id);

    if (index >= 0) {
      state.watches[index] = watch;
    } else {
      state.watches.push(watch);
    }

    await writeJsonFile(this.filePath, state);
  }

  public async remove(id: string): Promise<boolean> {
    const state = await this.readState();
    const nextWatches = state.watches.filter((watch) => watch.id !== id);

    if (nextWatches.length === state.watches.length) {
      return false;
    }

    await writeJsonFile(this.filePath, { watches: nextWatches });
    return true;
  }

  private async readState(): Promise<StoreState> {
    return readJsonFile<StoreState>(this.filePath, { watches: [] });
  }
}
