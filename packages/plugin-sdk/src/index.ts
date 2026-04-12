import { runCommandCapture } from "@morphase/shared";
import type { DetectionResult, InstallHint, MorphasePlugin, Platform } from "@morphase/shared";

export function definePlugin(plugin: MorphasePlugin): MorphasePlugin {
  return plugin;
}

export async function detectFirstAvailableCommand(
  commands: string[],
  versionArgs: string[] = ["--version"]
): Promise<DetectionResult> {
  for (const command of commands) {
    const result = await runCommandCapture(command, versionArgs);
    if (result.ok) {
      return {
        installed: true,
        version: result.stdout || result.stderr,
        command
      };
    }
  }

  return {
    installed: false,
    reason: `None of the expected commands were found: ${commands.join(", ")}`
  };
}

export function installHintByPlatform(
  platform: Platform,
  hints: Record<Platform, InstallHint>
): InstallHint[] {
  const hint = hints[platform];
  return hint ? [hint] : [{ manager: "manual", notes: ["Install the backend manually."] }];
}

