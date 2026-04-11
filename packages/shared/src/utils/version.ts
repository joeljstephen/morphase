export function parseFirstSemver(text: string): string | undefined {
  const match = text.match(/\d+\.\d+(?:\.\d+)?/);
  return match?.[0];
}

export function compareSemver(a: string, b: string): number {
  const partsA = a.split(".").map((part) => Number(part));
  const partsB = b.split(".").map((part) => Number(part));
  const length = Math.max(partsA.length, partsB.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (partsA[index] ?? 0) - (partsB[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

