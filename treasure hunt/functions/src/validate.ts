/**
 * validate.ts — Puzzle-agnostic answer grader.
 *
 * Contains ZERO puzzle-specific logic or content.
 * The grading algorithm is driven entirely by the AnswerDefinition
 * shape passed in; all actual answer values live in content/answers.ts.
 */

import type { AnswerDefinition } from "./schema.js";

// ── gradeAnswer ───────────────────────────────────────────────────────────────

/**
 * Returns true if `submitted` satisfies `definition`, false otherwise.
 *
 * `submitted` comes from untrusted client input, so we defend against
 * unexpected types at runtime even though TypeScript can't enforce that.
 */
export function gradeAnswer(submitted: unknown, definition: AnswerDefinition): boolean {
  switch (definition.mode) {
    // ── exact string match ─────────────────────────────────────────────
    case "exact": {
      if (typeof submitted !== "string") return false;
      const cs = definition.caseSensitive === true;
      const a = cs ? submitted.trim() : submitted.trim().toLowerCase();
      const b = cs ? definition.value.trim() : definition.value.trim().toLowerCase();
      return a === b;
    }

    // ── ordered sequence ───────────────────────────────────────────────
    case "sequence": {
      if (!Array.isArray(submitted)) return false;
      if (submitted.length !== definition.values.length) return false;
      return submitted.every(
        (v, i) =>
          typeof v === "string" &&
          v.trim().toLowerCase() === definition.values[i].trim().toLowerCase()
      );
    }

    // ── unordered set ──────────────────────────────────────────────────
    case "set": {
      if (!Array.isArray(submitted)) return false;
      const got = new Set(submitted.map((v) => String(v).trim().toLowerCase()));
      const want = new Set(definition.values.map((v) => v.trim().toLowerCase()));
      if (got.size !== want.size) return false;
      for (const v of want) {
        if (!got.has(v)) return false;
      }
      return true;
    }

    // ── numeric with tolerance ─────────────────────────────────────────
    case "numeric": {
      const n =
        typeof submitted === "number"
          ? submitted
          : parseFloat(String(submitted));
      if (isNaN(n)) return false;
      return Math.abs(n - definition.value) <= definition.tolerance;
    }

    // TypeScript exhaustive check — unreachable at runtime if schema is correct.
    default: {
      const _exhaustive: never = definition;
      void _exhaustive;
      return false;
    }
  }
}
