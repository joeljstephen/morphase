import type { Capability, MorphasePlugin, Platform, Route } from "@morphase/shared";

export class PluginRegistry {
  constructor(private readonly plugins: MorphasePlugin[]) {}

  list(): MorphasePlugin[] {
    return [...this.plugins].sort((left, right) => right.priority - left.priority);
  }

  get(pluginId: string): MorphasePlugin | undefined {
    return this.plugins.find((plugin) => plugin.id === pluginId);
  }

  capabilities(): Array<{ plugin: MorphasePlugin; capability: Capability }> {
    return this.plugins.flatMap((plugin) =>
      plugin.capabilities().map((capability) => ({ plugin, capability }))
    );
  }

  findCandidates(route: Route, platform: Platform): Array<{
    plugin: MorphasePlugin;
    capability: Capability;
  }> {
    return this.capabilities().filter(({ capability }) => {
      if (!capability.platforms.includes(platform)) {
        return false;
      }

      if (route.kind === "conversion") {
        return capability.from === route.from && capability.to === route.to;
      }

      return capability.from === route.resource && capability.operation === route.action;
    });
  }
}

