import fs from "node:fs/promises";
import path from "node:path";

import { muxoryConfigSchema, type MuxoryConfig } from "@muxory/shared";

import { homeDirectory } from "../platform/platform.js";

export async function loadMuxoryConfig(): Promise<MuxoryConfig> {
  const configPath = path.join(homeDirectory(), ".muxory", "config.json");

  try {
    const raw = await fs.readFile(configPath, "utf8");
    return muxoryConfigSchema.parse(JSON.parse(raw));
  } catch {
    return muxoryConfigSchema.parse({});
  }
}

