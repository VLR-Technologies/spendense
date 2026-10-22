import { repository } from "./repositories/local";
import { CloudRepository } from "./repositories/cloud";
import { browserClient } from "./supabase/browser";
import { validateBackup } from "./backup";
import type { Backup } from "./validation";
import { manifest } from "./migration";
export const accountMigration = {
  async review(profileId: string) {
    const backup = validateBackup(await repository.exportProfile(profileId));
    return { backup, manifest: manifest(backup) };
  },
  async import(backup: Backup, owner: string) {
    const client = browserClient();
    if (!client) throw new Error("Cloud storage is not configured.");
    return new CloudRepository(client, owner).migrate(backup);
  },
};
