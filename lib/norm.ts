// Answer normalisation: lowercase, strip accents, keep only letters and digits.
// "The Clock-Tower!" and "theclocktower" compare equal.
export function norm(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function matches(submitted: string, accepted: string[]): boolean {
  const s = norm(submitted);
  return s.length > 0 && accepted.some((a) => norm(a) === s);
}
