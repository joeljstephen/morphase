import { z } from "zod";

export const muxoryConfigSchema = z.object({
  offlineOnly: z.boolean().default(false),
  preferredBackends: z.record(z.string(), z.string()).default({}),
  debug: z.boolean().default(false),
  allowPackageManagerDelegation: z.boolean().default(false),
  server: z
    .object({
      host: z.string().default("127.0.0.1"),
      port: z.number().int().min(1).max(65535).default(3210)
    })
    .default({ host: "127.0.0.1", port: 3210 })
});

export type MuxoryConfig = z.infer<typeof muxoryConfigSchema>;
