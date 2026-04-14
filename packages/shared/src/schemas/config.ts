import { z } from "zod";

export const morphaseConfigSchema = z.object({
  offlineOnly: z.boolean().default(false),
  preferredBackends: z.record(z.string(), z.string()).default({}),
  debug: z.boolean().default(false),
  allowPackageManagerDelegation: z.boolean().default(false)
});

export type MorphaseConfig = z.infer<typeof morphaseConfigSchema>;
