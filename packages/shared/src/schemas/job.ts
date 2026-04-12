import { z } from "zod";

import { resourceKinds } from "../types/index.js";

const resourceKindSchema = z.enum(resourceKinds);

export const jobRequestSchema = z.object({
  input: z.union([z.string(), z.array(z.string()).min(1)]),
  from: resourceKindSchema.optional(),
  to: resourceKindSchema.optional(),
  operation: z.string().optional(),
  output: z.string().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
  backendPreference: z.string().optional(),
  offlineOnly: z.boolean().optional(),
  interactive: z.boolean().optional(),
  debug: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  force: z.boolean().optional(),
  keepTemp: z.boolean().optional()
});
