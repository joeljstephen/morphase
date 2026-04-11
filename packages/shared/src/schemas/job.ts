import { z } from "zod";

export const jobRequestSchema = z.object({
  input: z.union([z.string(), z.array(z.string()).min(1)]),
  from: z.string().optional(),
  to: z.string().optional(),
  operation: z.string().optional(),
  output: z.string().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
  backendPreference: z.string().optional(),
  offlineOnly: z.boolean().optional(),
  interactive: z.boolean().optional(),
  debug: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  keepTemp: z.boolean().optional()
});

