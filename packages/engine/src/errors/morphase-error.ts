import type { MorphaseError } from "@morphase/shared";

export class MorphaseRuntimeError extends Error {
  readonly details: MorphaseError;

  constructor(details: MorphaseError) {
    super(details.message);
    this.name = "MorphaseRuntimeError";
    this.details = details;
  }
}

export function createError(details: MorphaseError): MorphaseRuntimeError {
  return new MorphaseRuntimeError(details);
}

