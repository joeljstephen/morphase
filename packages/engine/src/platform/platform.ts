import os from "node:os";

import { runCommandCapture } from "@morphase/shared";
import type { Platform } from "@morphase/shared";

export function detectPlatform(): Platform {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

export async function detectPackageManager(
  platform: Platform = detectPlatform()
): Promise<"brew" | "winget" | "apt-get" | "manual"> {
  if (platform === "macos") {
    const brew = await runCommandCapture("brew", ["--version"]);
    return brew.ok ? "brew" : "manual";
  }

  if (platform === "windows") {
    const winget = await runCommandCapture("winget", ["--version"]);
    return winget.ok ? "winget" : "manual";
  }

  const aptGet = await runCommandCapture("apt-get", ["--version"]);
  if (aptGet.ok) {
    return "apt-get";
  }

  const brew = await runCommandCapture("brew", ["--version"]);
  return brew.ok ? "brew" : "manual";
}

export function homeDirectory(): string {
  return os.homedir();
}

