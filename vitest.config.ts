import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@muxory/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@muxory/plugin-sdk": path.resolve(__dirname, "packages/plugin-sdk/src/index.ts"),
      "@muxory/plugins": path.resolve(__dirname, "packages/plugins/src/index.ts"),
      "@muxory/engine": path.resolve(__dirname, "packages/engine/src/index.ts"),
      "@muxory/server": path.resolve(__dirname, "apps/server/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
