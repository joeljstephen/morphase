import type { MuxoryError } from "@muxory/shared";

export class MuxoryRuntimeError extends Error {
  readonly details: MuxoryError;

  constructor(details: MuxoryError) {
    super(details.message);
    this.name = "MuxoryRuntimeError";
    this.details = details;
  }
}

export function createError(details: MuxoryError): MuxoryRuntimeError {
  return new MuxoryRuntimeError(details);
}

