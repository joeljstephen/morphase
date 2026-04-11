import { spawn } from "node:child_process";

export async function runCommandCapture(
  command: string,
  args: string[] = [],
  options: { cwd?: string; env?: Record<string, string>; reject?: boolean } = {}
): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        stdout,
        stderr: error.message,
        exitCode: null
      });
    });

    child.on("close", (exitCode) => {
      resolve({
        ok: exitCode === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode
      });
    });
  });
}
