import { env } from "../../config/env.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "were",
  "will",
  "with",
  "you",
  "your",
  "our",
  "their",
  "this",
  "these",
  "those",
  "must",
  "should",
  "can",
  "not"
]);

const ACTION_VERBS = new Set([
  "built",
  "created",
  "designed",
  "delivered",
  "drove",
  "improved",
  "implemented",
  "launched",
  "led",
  "managed",
  "optimized",
  "reduced",
  "scaled",
  "streamlined",
  "increased"
]);

type AtsAnalysis = {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  improvements: string[];
};

type ResumeImproveResult = {
  improvedSummary: string;
  improvedBullets: string[];
  keywordSuggestions: string[];
  atsTips: string[];
};

export type ResumeTranslationInput = {
  targetLanguage: "English" | "Hindi" | "Spanish" | "French";
  resume: {
    jobTitle: string;
    location: string;
    summary: string;
    experiences: Array<{ title: string; dates: string; bullets: string[] }>;
    projects: string[];
    certifications: string[];
    languages: string[];
    achievements: string[];
    volunteer: string[];
    skills: string[];
    hobbies: string[];
  };
};

export type ResumeTranslationResult = ResumeTranslationInput["resume"];

function normalizeToken(token: string): string {
  const base = token.toLowerCase().replace(/[^a-z0-9+#.-]/g, "");
  if (base.length <= 3) return base;

  const suffixes = ["ments", "ment", "ations", "ation", "ingly", "ingly", "edly", "ing", "edly", "ed", "ies", "es", "s"];
  for (const suffix of suffixes) {
    if (base.endsWith(suffix) && base.length - suffix.length >= 3) {
      return base.slice(0, -suffix.length);
    }
  }
  return base;
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [])
    .map((word) => normalizeToken(word))
    .filter((word) => word && !STOP_WORDS.has(word));
}

function extractKeywords(text: string, maxKeywords = 20): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return b[0].length - a[0].length;
    })
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

function hasSection(resumeText: string, aliases: string[]): boolean {
  return aliases.some((alias) => new RegExp(`\\b${alias}\\b`, "i").test(resumeText));
}

export function analyzeAtsScore(resumeText: string, jobDescription: string): AtsAnalysis {
  const jdTokens = tokenize(jobDescription);
  const resumeTokens = tokenize(resumeText);
  const jdKeywords = extractKeywords(jobDescription, 22);

  const jdFreq = new Map<string, number>();
  jdTokens.forEach((token) => jdFreq.set(token, (jdFreq.get(token) ?? 0) + 1));
  const resumeFreq = new Map<string, number>();
  resumeTokens.forEach((token) => resumeFreq.set(token, (resumeFreq.get(token) ?? 0) + 1));

  const jdKeywordSet = new Set(jdKeywords.map((token) => normalizeToken(token)));
  const matchedKeywords = jdKeywords.filter((keyword) => resumeFreq.has(normalizeToken(keyword)));
  const missingKeywords = jdKeywords.filter((keyword) => !resumeFreq.has(normalizeToken(keyword)));

  const weightedKeywords = [...jdFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 26);
  const totalWeight = weightedKeywords.reduce((sum, [, count]) => sum + Math.min(count, 3), 0) || 1;
  const matchedWeight = weightedKeywords.reduce((sum, [token, count]) => {
    return sum + (resumeFreq.has(token) ? Math.min(count, 3) : 0);
  }, 0);
  const keywordCoverageScore = matchedWeight / totalWeight;

  const jdBigrams = new Set(
    jdTokens
      .slice(0, -1)
      .map((token, index) => `${token} ${jdTokens[index + 1]}`)
      .filter((phrase) => phrase.split(" ").every((word) => word.length > 2))
  );
  const resumeBigramSet = new Set(resumeTokens.slice(0, -1).map((token, index) => `${token} ${resumeTokens[index + 1]}`));
  const phraseMatches = [...jdBigrams].filter((phrase) => resumeBigramSet.has(phrase)).length;
  const phraseScore = jdBigrams.size ? Math.min(phraseMatches / Math.min(jdBigrams.size, 18), 1) : 0.55;

  const sections = [
    hasSection(resumeText, ["summary", "profile", "objective"]),
    hasSection(resumeText, ["experience", "work", "employment"]),
    hasSection(resumeText, ["education", "academic"]),
    hasSection(resumeText, ["skills", "tooling", "technologies"])
  ];
  const sectionCoverage = sections.filter(Boolean).length / sections.length;

  const numbersCount = (resumeText.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []).length;
  const metricsScore = Math.min(numbersCount / 8, 1);

  const bulletLines = resumeText
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.startsWith("-") || line.startsWith("*") || line.startsWith("•"));
  const actionVerbLines = bulletLines.filter((line) =>
    [...ACTION_VERBS].some((verb) => line.includes(` ${verb} `) || line.startsWith(`- ${verb}`) || line.startsWith(`* ${verb}`))
  ).length;
  const actionVerbScore = bulletLines.length ? Math.min(actionVerbLines / bulletLines.length, 1) : 0.35;

  const wordCount = resumeText.trim().split(/\s+/).filter(Boolean).length;
  const lengthScore = wordCount >= 220 && wordCount <= 950 ? 1 : wordCount < 220 ? Math.max(wordCount / 220, 0.55) : Math.max(0.55, 950 / wordCount);

  const matchedKeywordOccurrences = [...resumeFreq.entries()]
    .filter(([token]) => jdKeywordSet.has(token))
    .reduce((sum, [, count]) => sum + count, 0);
  const keywordDensity = resumeTokens.length ? matchedKeywordOccurrences / resumeTokens.length : 0;
  const repeatedKeywordCount = [...resumeFreq.entries()].filter(([token, count]) => jdKeywordSet.has(token) && count >= 6).length;
  const stuffingPenalty = Math.min(16, Math.max(0, (keywordDensity - 0.085) * 120) + repeatedKeywordCount * 1.5);

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        keywordCoverageScore * 34 +
          phraseScore * 16 +
          sectionCoverage * 15 +
          metricsScore * 14 +
          actionVerbScore * 11 +
          lengthScore * 10 -
          stuffingPenalty
      )
    )
  );

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (keywordCoverageScore >= 0.62) strengths.push("Strong keyword alignment with the job description.");
  if (phraseScore >= 0.42) strengths.push("Good contextual matching of role-specific phrases.");
  if (sectionCoverage >= 0.75) strengths.push("Resume includes core ATS-friendly sections.");
  if (metricsScore >= 0.5) strengths.push("Good use of numbers and measurable impact.");
  if (actionVerbScore >= 0.5) strengths.push("Bullets use clear action-oriented language.");

  if (missingKeywords.length > 0) {
    improvements.push(`Add missing role keywords: ${missingKeywords.slice(0, 8).join(", ")}.`);
  }
  if (stuffingPenalty >= 4) {
    improvements.push("Avoid keyword stuffing; use fewer repeated terms and add natural context.");
  }
  if (sectionCoverage < 0.75) {
    improvements.push("Add standard headings like Summary, Experience, Education, and Skills.");
  }
  if (metricsScore < 0.4) {
    improvements.push("Quantify achievements with percentages, counts, or revenue impact.");
  }
  if (actionVerbScore < 0.5) {
    improvements.push("Start bullets with stronger action verbs and tighter outcomes.");
  }

  if (strengths.length === 0) {
    strengths.push("Resume contains baseline content to iterate on.");
  }
  if (improvements.length === 0) {
    improvements.push("Tailor wording to each job post before applying.");
  }

  return {
    score,
    matchedKeywords,
    missingKeywords,
    strengths,
    improvements
  };
}

function extractGeminiText(responseJson: unknown): string {
  const candidates = (responseJson as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  if (!candidates?.length) return "";
  const parts = candidates[0].content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("\n").trim();
}

async function requestGeminiJson(prompt: string, temperature = 0.2): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json"
      }
    })
  });
}

function safeJsonParse(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const payload = fenced ? fenced[1] : text;
  return JSON.parse(payload);
}

function extractProviderErrorMessage(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
    return parsed.error?.message?.trim() || "";
  } catch {
    return "";
  }
}

function parseSections(resumeText: string): Record<string, string> {
  const markers = new Set([
    "Summary",
    "Experience",
    "Skills",
    "Education",
    "Projects",
    "Certifications",
    "Languages",
    "Achievements",
    "Volunteer"
  ]);
  const sections: Record<string, string[]> = {};
  let active: string | null = null;

  for (const rawLine of resumeText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (markers.has(line)) {
      active = line.toLowerCase();
      sections[active] = sections[active] ?? [];
      continue;
    }
    if (active) {
      sections[active].push(line);
    }
  }

  return Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, value.join("\n")]));
}

function fallbackImproveResult(
  resumeText: string,
  jobTitle?: string,
  focus: "summary" | "bullets" | "full" = "full"
): ResumeImproveResult {
  const sections = parseSections(resumeText);
  const baseSummary = sections.summary?.split("\n").filter(Boolean).slice(0, 2).join(" ") ?? "";
  const experienceLines = (sections.experience ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = experienceLines
    .filter((line) => line.startsWith("-") || line.startsWith("*") || line.startsWith("•"))
    .slice(0, 4)
    .map((line) => line.replace(/^[-*•]\s*/, ""));

  const improvedSummary =
    focus === "bullets"
      ? baseSummary ||
        (jobTitle && jobTitle.trim().length
          ? `${jobTitle.trim()} professional focused on measurable business outcomes and cross-functional execution.`
          : "Results-driven professional focused on measurable outcomes and cross-functional execution.")
      : baseSummary
        ? `${baseSummary.replace(/\.$/, "")}. Delivered measurable impact through ownership, prioritization, and data-informed decisions.`
        : jobTitle && jobTitle.trim().length
          ? `${jobTitle.trim()} professional focused on measurable business outcomes, cross-functional execution, and continuous optimization.`
          : "Results-driven professional focused on measurable outcomes, cross-functional execution, and continuous optimization.";

  const improvedBullets =
    focus === "summary"
      ? bullets.length
        ? bullets
        : ["Led key initiatives to improve delivery speed and quality.", "Collaborated across teams to ship customer-focused outcomes."]
      : bullets.length > 0
        ? bullets.map((bullet) => bullet.replace(/\.$/, "") + " with measurable business impact.")
        : [
            "Led key initiatives to improve delivery speed and quality with measurable business impact.",
            "Collaborated across teams to ship customer-focused outcomes with measurable business impact."
          ];

  return {
    improvedSummary,
    improvedBullets,
    keywordSuggestions: extractKeywords(resumeText, 8),
    atsTips: [
      "Keep section headings standard: Summary, Experience, Education, Skills.",
      "Mirror key terms from the target job description naturally in bullets.",
      "Add numbers to show scale, ownership, and outcomes."
    ]
  };
}

export async function improveResumeWithGemini(input: {
  resumeText: string;
  jobDescription?: string;
  jobTitle?: string;
  focus?: "summary" | "bullets" | "full";
}): Promise<ResumeImproveResult> {
  if (!env.GEMINI_API_KEY) {
    return fallbackImproveResult(input.resumeText, input.jobTitle, input.focus ?? "full");
  }

  const prompt = [
    "You are an expert ATS resume coach.",
    "Return strict JSON only with keys: improvedSummary, improvedBullets, keywordSuggestions, atsTips.",
    "Constraints:",
    "- improvedSummary: 2-3 lines, professional and concise.",
    "- improvedBullets: array of 3-5 bullets, each under 24 words, impact-focused.",
    "- keywordSuggestions: array of 6-10 role-relevant keywords.",
    "- atsTips: array of 3-6 practical ATS improvements.",
    `Focus area: ${input.focus ?? "full"}.`,
    input.jobTitle ? `Target role: ${input.jobTitle}` : "Target role: Not provided.",
    input.jobDescription ? `Job description:\n${input.jobDescription}` : "Job description: Not provided.",
    `Resume text:\n${input.resumeText}`
  ].join("\n");

  const response = await requestGeminiJson(prompt, 0.3);

  if (!response.ok) {
    const bodyText = await response.text();
    const providerMessage = extractProviderErrorMessage(bodyText);

    if (response.status === 429 || response.status === 401 || response.status === 403) {
      return fallbackImproveResult(input.resumeText, input.jobTitle, input.focus ?? "full");
    }

    throw new Error(
      providerMessage
        ? `AI writing assistant is temporarily unavailable (${response.status}): ${providerMessage}`
        : `AI writing assistant is temporarily unavailable (${response.status}).`
    );
  }

  const responseJson = (await response.json()) as unknown;
  const outputText = extractGeminiText(responseJson);

  if (!outputText) {
    return fallbackImproveResult(input.resumeText, input.jobTitle, input.focus ?? "full");
  }

  try {
    const parsed = safeJsonParse(outputText) as Partial<ResumeImproveResult>;
    const fallback = fallbackImproveResult(input.resumeText, input.jobTitle, input.focus ?? "full");
    const improvedBullets = Array.isArray(parsed.improvedBullets) ? parsed.improvedBullets.slice(0, 5).map((value) => String(value)) : [];
    const keywordSuggestions = Array.isArray(parsed.keywordSuggestions)
      ? parsed.keywordSuggestions.slice(0, 10).map((value) => String(value))
      : [];
    const atsTips = Array.isArray(parsed.atsTips) ? parsed.atsTips.slice(0, 6).map((value) => String(value)) : [];

    return {
      improvedSummary: parsed.improvedSummary?.trim() || fallback.improvedSummary,
      improvedBullets: improvedBullets.length ? improvedBullets : fallback.improvedBullets,
      keywordSuggestions: keywordSuggestions.length ? keywordSuggestions : fallback.keywordSuggestions,
      atsTips: atsTips.length ? atsTips : fallback.atsTips
    };
  } catch {
    return fallbackImproveResult(input.resumeText, input.jobTitle, input.focus ?? "full");
  }
}

export async function translateResumeWithGemini(input: ResumeTranslationInput): Promise<ResumeTranslationResult> {
  if (input.targetLanguage === "English") {
    return input.resume;
  }

  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for full resume translation.");
  }

  const prompt = [
    `Translate this resume JSON to ${input.targetLanguage}.`,
    "Return strict JSON only in the exact same shape.",
    "Rules:",
    "- Keep dates, numbers, company names, and proper nouns unchanged when appropriate.",
    "- Preserve bullet intent and metric values.",
    "- Do not add or remove fields.",
    "- Keep concise, professional resume language.",
    `JSON:\n${JSON.stringify(input.resume)}`
  ].join("\n");

  const response = await requestGeminiJson(prompt, 0.2);

  if (!response.ok) {
    const bodyText = await response.text();
    const providerMessage = extractProviderErrorMessage(bodyText);

    if (response.status === 429) {
      throw new Error("Translation quota exceeded for GEMINI_API_KEY. Please enable billing or use a new key.");
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error("GEMINI_API_KEY is invalid or unauthorized for translation requests.");
    }

    throw new Error(
      providerMessage
        ? `Resume translation failed (${response.status}): ${providerMessage}`
        : `Resume translation failed (${response.status}).`
    );
  }

  const responseJson = (await response.json()) as unknown;
  const outputText = extractGeminiText(responseJson);
  if (!outputText) return input.resume;

  try {
    const parsed = safeJsonParse(outputText) as Partial<ResumeTranslationResult>;
    return {
      jobTitle: String(parsed.jobTitle ?? input.resume.jobTitle),
      location: String(parsed.location ?? input.resume.location),
      summary: String(parsed.summary ?? input.resume.summary),
      experiences: Array.isArray(parsed.experiences)
        ? parsed.experiences.slice(0, 8).map((item) => ({
            title: String(item?.title ?? ""),
            dates: String(item?.dates ?? ""),
            bullets: Array.isArray(item?.bullets) ? item.bullets.slice(0, 8).map((bullet) => String(bullet)) : []
          }))
        : input.resume.experiences,
      projects: Array.isArray(parsed.projects) ? parsed.projects.slice(0, 15).map((value) => String(value)) : input.resume.projects,
      certifications: Array.isArray(parsed.certifications)
        ? parsed.certifications.slice(0, 15).map((value) => String(value))
        : input.resume.certifications,
      languages: Array.isArray(parsed.languages) ? parsed.languages.slice(0, 10).map((value) => String(value)) : input.resume.languages,
      achievements: Array.isArray(parsed.achievements)
        ? parsed.achievements.slice(0, 15).map((value) => String(value))
        : input.resume.achievements,
      volunteer: Array.isArray(parsed.volunteer) ? parsed.volunteer.slice(0, 15).map((value) => String(value)) : input.resume.volunteer,
      skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 25).map((value) => String(value)) : input.resume.skills,
      hobbies: Array.isArray(parsed.hobbies) ? parsed.hobbies.slice(0, 15).map((value) => String(value)) : input.resume.hobbies
    };
  } catch {
    return input.resume;
  }
}

export async function parseResumeWithGemini(text: string): Promise<any> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required to parse resumes.");
  }

  const prompt = [
    `Extract the following resume text into a structured JSON object.`,
    "Return strict JSON only.",
    "The JSON should match this exact interface:",
    `{
      fullName: string;
      jobTitle: string;
      email: string;
      phone: string;
      location: string;
      profileLink: string;
      summary: string;
      skills: string[]; // Try to extract technical and soft skills into an array
      educationDegree: string;
      educationSchool: string;
      educationYear: string;
      experiences: Array<{ title: string; dates: string; bullets: string }>; // For bullets, join them with newlines
      projects: string[]; // Keep one project per string, include description if any
      certifications: string[];
      languages: string[];
      achievements: string[];
      volunteer: string[];
    }`,
    "- Keep null or empty string if a field is not found.",
    "- Do not add or remove fields.",
    `RESUME TEXT:\n${text}`
  ].join("\n");

  const response = await requestGeminiJson(prompt, 0.2);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API Error:", response.status, errorText);
    throw new Error(`AI parse failed with status ${response.status}`);
  }

  const responseJson = await response.json();
  const outputText = extractGeminiText(responseJson);

  if (!outputText) {
    throw new Error("Empty response from AI");
  }

  return safeJsonParse(outputText);
}
