export class Logger {
  constructor(private readonly enabledDebug = false) {}

  planner(message: string): string {
    return `[planner] ${message}`;
  }

  doctor(message: string): string {
    return `[doctor] ${message}`;
  }

  executor(message: string): string {
    return `[executor] ${message}`;
  }

  plugin(pluginId: string, message: string): string {
    return `[plugin:${pluginId}] ${message}`;
  }

  debug(message: string): string | null {
    if (!this.enabledDebug) {
      return null;
    }

    return `[debug] ${message}`;
  }
}

