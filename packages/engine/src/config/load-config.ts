import fs from "node:fs/promises";
import path from "node:path";

import { morphaseConfigSchema, type MorphaseConfig } from "@morphase/shared";

import { homeDirectory } from "../platform/platform.js";

export async function loadMorphaseConfig(): Promise<MorphaseConfig> {
  const configPath = path.join(homeDirectory(), ".morphase", "config.json");

  try {
    const raw = await fs.readFile(configPath, "utf8");
    return morphaseConfigSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return morphaseConfigSchema.parse({});
    }

    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load Morphase config from ${configPath}: ${reason}`);
  }
}
