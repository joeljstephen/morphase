import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadMorphaseConfig } from "../packages/engine/src/config/load-config.js";

describe("loadMorphaseConfig", () => {
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  const tempRoots: string[] = [];

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalUserProfile;
    }

    for (const directory of tempRoots.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("returns defaults when no config file exists", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "morphase-config-"));
    tempRoots.push(home);
    process.env.HOME = home;
    process.env.USERPROFILE = home;

    await expect(loadMorphaseConfig()).resolves.toMatchObject({
      offlineOnly: false,
      debug: false
    });
  });

  it("fails closed when the config file is invalid", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "morphase-config-"));
    tempRoots.push(home);
    process.env.HOME = home;
    process.env.USERPROFILE = home;

    const configDir = path.join(home, ".morphase");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, "config.json"), "{ invalid-json");

    await expect(loadMorphaseConfig()).rejects.toThrow(/Failed to load Morphase config/);
  });
});
