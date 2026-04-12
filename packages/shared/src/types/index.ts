export const resourceKinds = [
  "markdown",
  "html",
  "docx",
  "pptx",
  "xlsx",
  "odt",
  "ods",
  "odp",
  "pdf",
  "txt",
  "jpg",
  "png",
  "webp",
  "heic",
  "mp3",
  "wav",
  "mp4",
  "mov",
  "mkv",
  "url",
  "youtube-url",
  "media-url",
  "subtitle",
  "transcript"
] as const;

export type ResourceKind = (typeof resourceKinds)[number];

export type Platform = "macos" | "windows" | "linux";

export type Route =
  | {
      kind: "conversion";
      from: ResourceKind;
      to: ResourceKind;
    }
  | {
      kind: "operation";
      resource: ResourceKind;
      action: string;
    };

export type JobStatus =
  | "queued"
  | "planned"
  | "running"
  | "success"
  | "failed"
  | "cancelled";

export type Quality = "high" | "medium" | "best_effort";

export type CapabilityKind = "convert" | "extract" | "fetch" | "transform";

export type Capability = {
  kind: CapabilityKind;
  from: ResourceKind | null;
  to: ResourceKind | null;
  operation?: string;
  quality: Quality;
  offline: boolean;
  platforms: Platform[];
  notes?: string[];
};

export type DetectionResult = {
  installed: boolean;
  version?: string;
  reason?: string;
  command?: string;
};

export type VerificationResult = {
  ok: boolean;
  issues?: string[];
  warnings?: string[];
};

export type InstallHint = {
  manager: "brew" | "winget" | "apt-get" | "manual";
  command?: string;
  notes?: string[];
};

export type OutputMapping = {
  source: string;
  target: string;
};

export type ExecutionPlan = {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  tempDirs?: string[];
  expectedOutputs?: string[];
  outputMapping?: OutputMapping[];
  stdoutFile?: string;
  timeoutMs?: number;
  notes?: string[];
};

export type PlanRequest = {
  input: string | string[];
  from?: ResourceKind;
  to?: ResourceKind;
  operation?: string;
  output?: string;
  options: Record<string, unknown>;
  platform: Platform;
  offlineOnly: boolean;
  route: Route;
};

export type PlannedStep = {
  pluginId: string;
  route: Route;
  plan: ExecutionPlan;
};

export type PipelineDefinition = {
  id: string;
  route: Route;
  steps: Array<{
    pluginId: string;
    from: ResourceKind;
    to?: ResourceKind;
    operation?: string;
  }>;
  quality: Quality;
};

export type MorphaseError = {
  code: string;
  message: string;
  likelyCause?: string;
  suggestedFixes?: string[];
  backendId?: string;
  rawStdout?: string;
  rawStderr?: string;
};

export type JobRequest = {
  input: string | string[];
  from?: ResourceKind;
  to?: ResourceKind;
  operation?: string;
  output?: string;
  options?: Record<string, unknown>;
  backendPreference?: string;
  offlineOnly?: boolean;
  interactive?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  force?: boolean;
  keepTemp?: boolean;
};

export type JobResult = {
  jobId: string;
  status: "success" | "failed" | "cancelled";
  backendId?: string;
  outputPaths: string[];
  logs: string[];
  warnings?: string[];
  error?: MorphaseError;
  equivalentCommand?: string;
};

export type JobRecord = {
  id: string;
  request: JobRequest;
  route: Route;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  selectedPlugin?: string;
  logs: string[];
  warnings: string[];
  outputPaths: string[];
  error?: MorphaseError;
  result?: JobResult;
};

export type BackendDoctorReport = {
  id: string;
  name: string;
  installed: boolean;
  version?: string;
  minimumVersion?: string;
  versionSupported: boolean;
  command?: string;
  verified: boolean;
  issues: string[];
  warnings: string[];
  installHints: InstallHint[];
  updateHints: InstallHint[];
  commonProblems: string[];
};

export type PlannerCandidate = {
  pluginId: string;
  score: number;
  explanation: string[];
  installed: boolean;
  verified: boolean;
  versionSupported: boolean;
  detection: DetectionResult;
  verification: VerificationResult;
  capability: Capability;
};

export type PlannedExecution = {
  selectedPluginId: string;
  explanation: string;
  warnings: string[];
  installNeeded: boolean;
  fallbacks: string[];
  steps: PlannedStep[];
  equivalentCommand?: string;
};

export interface MorphasePlugin {
  id: string;
  name: string;
  priority: number;
  minimumVersion?: string;
  optional?: boolean;
  commonProblems?: string[];

  capabilities(): Capability[];
  detect(platform: Platform): Promise<DetectionResult>;
  verify(platform: Platform): Promise<VerificationResult>;
  getInstallHints(platform: Platform): InstallHint[];
  getUpdateHints?(platform: Platform): InstallHint[];
  plan(request: PlanRequest): Promise<ExecutionPlan | null>;
  explain(request: PlanRequest): Promise<string>;
}
