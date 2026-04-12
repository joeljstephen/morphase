import fs from "node:fs/promises";
import path from "node:path";

import { morphaseConfigSchema, type MorphaseConfig } from "@morphase/shared";

import { homeDirectory } from "../platform/platform.js";

export async function loadMorphaseConfig(): Promise<MorphaseConfig> {
  const configPath = path.join(homeDirectory(), ".morphase", "config.json");

  try {
    const raw = await fs.readFile(configPath, "utf8");
    return morphaseConfigSchema.parse(JSON.parse(raw));
  } catch {
    return morphaseConfigSchema.parse({});
  }
}

