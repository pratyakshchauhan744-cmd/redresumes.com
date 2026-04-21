import { createHash } from "crypto";

type DedupeInput = {
  title: string;
  company: string;
  city?: string | null;
  description: string;
};

export function createJobDedupeHash(input: DedupeInput): string {
  const value = `${input.title}|${input.company}|${input.city ?? ""}|${input.description}`.toLowerCase();
  return createHash("sha256").update(value).digest("hex");
}
