import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@morphase/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@morphase/plugin-sdk": path.resolve(__dirname, "packages/plugin-sdk/src/index.ts"),
      "@morphase/plugins": path.resolve(__dirname, "packages/plugins/src/index.ts"),
      "@morphase/engine": path.resolve(__dirname, "packages/engine/src/index.ts"),
      "@morphase/server": path.resolve(__dirname, "apps/server/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
