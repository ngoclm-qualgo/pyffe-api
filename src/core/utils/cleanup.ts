// src/core/utils/cleanup.ts
import { createLogger } from './logger';

const log = createLogger('cleanup');

export class CleanupRegistry {
  private tasks: { name: string; fn: () => Promise<void> }[] = [];

  add(name: string, fn: () => Promise<void>) { this.tasks.push({ name, fn }); }

  async run(): Promise<string[]> {
    const failed: string[] = [];
    for (const t of this.tasks.reverse()) { // delete in reverse order of data relationships
      try { await t.fn(); }
      catch (err) { failed.push(t.name); log.error(`Clean up ${t.name} failed`, { err, resource: t.name }); }
    }
    this.tasks = [];
    return failed; // written to a file for scripts/cleanup-test-data.ts to handle
  }
}