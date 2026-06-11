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
  if (env.OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature,
        response_format: { type: "json_object" }
      })
    });
    if (res.ok) {
      const json = await res.json() as any;
      const text = json.choices?.[0]?.message?.content || "";
      const compatibleJson = {
        candidates: [{
          content: {
            parts: [{ text }]
          }
        }]
      };
      return new Response(JSON.stringify(compatibleJson), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return res;
  }

  if (!env.GEMINI_API_KEY) {
    throw new Error("Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured.");
  }

  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
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

async function requestGeminiText(prompt: string, temperature = 0.5): Promise<Response> {
  if (env.OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature
      })
    });
    if (res.ok) {
      const json = await res.json() as any;
      const text = json.choices?.[0]?.message?.content || "";
      const compatibleJson = {
        candidates: [{
          content: {
            parts: [{ text }]
          }
        }]
      };
      return new Response(JSON.stringify(compatibleJson), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return res;
  }

  if (!env.GEMINI_API_KEY) {
    throw new Error("Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured.");
  }

  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature
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
  if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
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

  if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
    throw new Error("Either GEMINI_API_KEY or OPENAI_API_KEY is required for full resume translation.");
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

function getFallbackParsedResume(text: string) {
  return {
    isResume: true,
    fullName: "Applicant",
    jobTitle: "Professional",
    email: "",
    phone: "",
    location: "",
    profileLink: "",
    summary: text.substring(0, 200) + "...",
    skills: ["Communication", "Problem Solving", "Adaptability"],
    educationDegree: "Bachelor's Degree",
    educationSchool: "University",
    educationYear: "",
    experiences: [
      {
        title: "Previous Role",
        dates: "Past - Present",
        bullets: "Successfully managed projects.\nCollaborated with cross-functional teams."
      }
    ],
    projects: [],
    certifications: [],
    languages: ["English"],
    achievements: [],
    volunteer: []
  };
}

export async function parseResumeWithGemini(text: string): Promise<any> {
  if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
    return getFallbackParsedResume(text);
  }

  const prompt = [
    `Analyze the input text. CRITICAL INSTRUCTION: If the text does NOT appear to be a genuine resume, CV, or professional profile (e.g. if it is a receipt, textbook, research paper, terms of service, random code, logs, conversational text, or other unrelated document), you MUST set "isResume" to false and leave the rest of the fields empty. Otherwise, if it IS a valid resume, set "isResume" to true and extract the text into a structured JSON object.`,
    "Return strict JSON only.",
    "The JSON should match this exact interface:",
    `{
      isResume: boolean; // MUST be false if the document is NOT a valid resume, CV, or professional profile. MUST be true otherwise.
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

  let response;
  try {
    response = await requestGeminiJson(prompt, 0.2);
  } catch (err) {
    console.error("Gemini API Request Error:", err);
    return getFallbackParsedResume(text);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API Error:", response.status, errorText);
    return getFallbackParsedResume(text);
  }

  const responseJson = await response.json();
  const outputText = extractGeminiText(responseJson);

  if (!outputText) {
    throw new Error("Empty response from AI");
  }

  return sanitizeParsedData(safeJsonParse(outputText));
}

/**
 * Recursively strip \u0000 (null bytes) from strings in parsed data.
 * Postgres text columns reject \u0000, so PDFs containing these will crash prisma.create().
 */
function sanitizeParsedData(data: unknown): unknown {
  if (typeof data === 'string') {
    return data.replace(/\u0000/g, '');
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeParsedData);
  }
  if (data !== null && typeof data === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      out[key] = sanitizeParsedData(value);
    }
    return out;
  }
  return data;
}

// ==========================================
// INTERVIEW PRACTICE AI FUNCTIONS
// ==========================================

export async function generateInterviewQuestion(
  resumeData: any,
  targetRole: string,
  companyType: string,
  difficulty: string,
  style: string,
  jobDescription?: string,
  interviewerPersona?: string,
  stressMode?: boolean
): Promise<string> {
  if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
    return `Can you walk me through your experience relevant to a ${targetRole} position?`;
  }

  const persona = interviewerPersona || "Professional Interviewer";
  let greetingAndIntro = "";
  let personaInstruction = "";

  if (persona === "Technical Interviewer") {
    greetingAndIntro = `Hello and welcome. I am your Technical Interviewer today. I have reviewed your resume and I'd like to dive straight into your technical background.`;
    personaInstruction = `You are a Technical Interviewer for a ${companyType} company interviewing a candidate for a ${targetRole} role. You focus on algorithms, data modeling, architecture, logic, debugging, and concrete technical details. Keep your response brief, professional, and precise. Greet them and ask ONE tailored, role-specific opening technical question based on their resume experience.`;
  } else if (persona === "HR Recruiter") {
    greetingAndIntro = `Hi there! Welcome. It's a pleasure to meet you. I'm your HR Recruiter for today's session. I'd love to start by getting to know you a bit better.`;
    personaInstruction = `You are an HR Recruiter for a ${companyType} company interviewing a candidate for a ${targetRole} role. You focus on behavioral aspects, teamwork, communication, conflict resolution, strengths, weaknesses, and career goals. Keep your response friendly, welcoming, and conversational. Greet them warmly and ask ONE opening behavioral or introductory question.`;
  } else if (persona === "Hiring Manager") {
    greetingAndIntro = `Hello, welcome. I'm the Hiring Manager for the team. I've been looking over your profile and I'm excited to talk about the impact of your work.`;
    personaInstruction = `You are a Hiring Manager for a ${companyType} company interviewing a candidate for a ${targetRole} role. You focus on project ownership, business impact, KPI outcomes, strategic decisions, and culture fit. Keep your response professional, outcomes-oriented, and structured. Greet them and ask ONE opening question about a project they owned or their biggest business impact.`;
  } else if (persona === "Startup Founder") {
    greetingAndIntro = `Hey, welcome! I'm the founder. We're building fast here, so I'd love to jump right in.`;
    personaInstruction = `You are a Startup Founder for a ${companyType} company interviewing a candidate for a ${targetRole} role. You focus on extreme ownership, independence, handling ambiguity, speed, scaling vision, and drive. Keep your response direct, energetic, and challenging. Greet them and ask ONE opening question testing their self-direction or ability to execute fast.`;
  } else {
    greetingAndIntro = `Hello and welcome. I am your interviewer today.`;
    personaInstruction = `You are a professional interviewer for a ${companyType} company interviewing a candidate for a ${targetRole} role. Greet them and ask ONE opening question.`;
  }

  const stressInstruction = stressMode ? "Adopt an aggressive, highly critical, demanding tone. Ask a high-pressure, challenging question." : "Maintain a professional, conversational tone.";
  const jdInstruction = jobDescription ? `Align your question closely with this Job Description: ${jobDescription}` : "";

  const prompt = [
    personaInstruction,
    stressInstruction,
    jdInstruction,
    `The difficulty level is ${difficulty}. The style is ${style}.`,
    `Review the candidate's resume data: ${JSON.stringify(resumeData)}`,
    `Generate the full text of your greeting and opening question. Do not include quotes or meta-commentary, just return the spoken interviewer dialogue. Begin with: "${greetingAndIntro}" and then transition naturally into the opening question.`
  ].join("\n");

  const response = await requestGeminiText(prompt, 0.5);
  if (!response.ok) return `${greetingAndIntro} Can you start by walking me through your background and your experience relevant to a ${targetRole}?`;
  const responseJson = await response.json();
  const outputText = extractGeminiText(responseJson);
  return outputText ? outputText.replace(/^["']|["']$/g, "").replace(/```/g, "").trim() : `${greetingAndIntro} Tell me about your background.`;
}

export async function generateInterviewFollowUp(
  qaHistory: Array<{ questionText: string; answerText?: string; questionType?: string }>,
  resumeData: any,
  jobDescription?: string,
  interviewerPersona?: string,
  stressMode?: boolean
): Promise<string> {
  const roundNumber = qaHistory.length;
  const lastInteraction = qaHistory[qaHistory.length - 1];
  const previousQuestion = lastInteraction?.questionText || "";
  const candidateAnswer = lastInteraction?.answerText || "";

  if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
    if (interviewerPersona === "Technical Interviewer") {
      if (roundNumber === 1) return "Could explain the system architecture of the most challenging project you've worked on?";
      if (roundNumber === 2) return "What database optimizations did you make, and how did you measure the performance improvements?";
      if (roundNumber === 3) return "How do you handle memory management and race conditions in a highly concurrent environment?";
      return "If you had to redesign that system from scratch today, what would you do differently?";
    } else if (interviewerPersona === "Hiring Manager") {
      if (roundNumber === 1) return "Tell me about a project where you had complete ownership. What was the business impact?";
      if (roundNumber === 2) return "How did you handle prioritization conflicts when engineering scope collided with business deadlines?";
      if (roundNumber === 3) return "Describe a time when you had to align multiple teams on a controversial technical decision. What was the outcome?";
      return "How do you measure success for yourself and your team?";
    } else {
      if (roundNumber === 1) return "Can you describe a time when you had to resolve a conflict within your team?";
      if (roundNumber === 2) return "What are your short-term and long-term career goals, and how does this role fit into them?";
      if (roundNumber === 3) return "Tell me about a time you failed or made a mistake. What did you learn from it?";
      return "What kind of work culture allows you to perform at your best?";
    }
  }

  const persona = interviewerPersona || "Professional Interviewer";
  let personaInstruction = "";

  if (persona === "Technical Interviewer") {
    personaInstruction = `You are a Technical Interviewer. Analyze the candidate's last response and the entire conversation history.
Focus on: Technical depth, algorithms, data structures, scaling, databases, debugging, edge cases, and design choices.
Behavior:
- React naturally and transition: start with a quick, realistic spoken reaction (1 sentence max) referencing their last answer (e.g., "Virtualization is definitely a good choice for rendering large lists," or "I see, resolving race conditions can get tricky.").
- Keep it adaptive: if their technical answer was weak or superficial, ask a slightly easier or clarifying question to test their baseline. If it was strong, escalate the technical difficulty (architecture, tradeoffs, internals).
- Probe details: ask for specific performance metrics, tech stack choices, or debugging steps.
- DO NOT repeat any questions or topics that were already discussed in the Q&A history.`;
  } else if (persona === "HR Recruiter") {
    personaInstruction = `You are an HR Recruiter. Analyze the candidate's last response and the entire conversation history.
Focus on: Behavioral aspects, communication, emotional intelligence, teamwork, alignment with culture, conflict resolution, strengths, and weaknesses.
Behavior:
- React naturally and transition: start with a warm, conversational reaction (1 sentence max) referencing their last answer (e.g., "It sounds like that conflict really taught you the value of open communication," or "That is a very clear career goal.").
- Probe details: ask about how they felt, how they kept others aligned, what compromise was reached, or how they measured communication success.
- DO NOT repeat any questions or topics that were already discussed in the Q&A history.`;
  } else if (persona === "Hiring Manager") {
    personaInstruction = `You are a Hiring Manager. Analyze the candidate's last response and the entire conversation history.
Focus on: Project ownership, KPI metrics, business value, prioritization, decision-making, trade-offs under deadlines, leadership, and culture fit.
Behavior:
- React naturally and transition: start with an outcome-oriented, professional reaction (1 sentence max) referencing their last answer (e.g., "A 10% revenue lift is a great business outcome," or "Balancing product features and tech debt is always a challenging trade-off.").
- Probe details: ask about their role in the decisions, why they chose a particular strategy, how they aligned stakeholder expectations, or how they handled setbacks.
- DO NOT repeat any questions or topics that were already discussed in the Q&A history.`;
  } else if (persona === "Startup Founder") {
    personaInstruction = `You are a Startup Founder. Analyze the candidate's last response and the entire conversation history.
Focus on: Independence, speed of execution, passion, self-direction, scaling, and drive.
Behavior:
- React naturally and transition: start with a direct, fast-paced reaction (1 sentence max) referencing their last answer (e.g., "Shipping in a week is the kind of speed we like," or "Moving fast sometimes breaks things, which is fine.").
- Probe details: ask about how they managed under extreme uncertainty, how they decided what not to build, or how they stayed motivated.
- DO NOT repeat any questions or topics that were already discussed in the Q&A history.`;
  } else {
    personaInstruction = `You are a professional interviewer. React naturally to the candidate's answer and ask a relevant follow-up question. Do not repeat previous topics.`;
  }

  const stressInstruction = stressMode
    ? "Be highly critical, demanding, and direct. Interrupt vague answers or call out filler words. Press for exact metrics and facts."
    : "Maintain a professional, constructive, and conversational tone.";
  const jdInstruction = jobDescription ? `Ensure your follow-up tests skills mentioned in this Job Description: ${jobDescription}` : "";

  const prompt = [
    personaInstruction,
    `The candidate was asked: "${previousQuestion}"`,
    `They answered: "${candidateAnswer}"`,
    stressInstruction,
    jdInstruction,
    `Review the complete conversation history to avoid repeating questions: ${JSON.stringify(qaHistory)}`,
    `Review candidate's resume data: ${JSON.stringify(resumeData)}`,
    `Generate ONLY the next spoken follow-up question, including the natural transition phrase. Do not include quotes or conversational meta-text. Speak directly to the candidate.`
  ].join("\n");

  const response = await requestGeminiText(prompt, 0.5);
  if (!response.ok) return "Could you expand on that with a specific example?";
  const responseJson = await response.json();
  const outputText = extractGeminiText(responseJson);
  return outputText ? outputText.replace(/^["']|["']$/g, "").replace(/```/g, "").trim() : "Can you elaborate on that?";
}

export function generateImprovedExampleLocally(question: string, targetRole: string): string {
  const q = question.toLowerCase();
  if (q.includes("architecture") || q.includes("system") || q.includes("design") || q.includes("scale") || q.includes("data") || q.includes("database")) {
    return `Situation: In my previous role as a ${targetRole}, our web platform experienced a 40% surge in user traffic, causing API latency to degrade by 2.4 seconds.\n` +
      `Task: I was tasked with refactoring the database access layer and introducing a caching layer to bring latency down to < 200ms.\n` +
      `Action: I designed a Redis-backed caching strategy with a cache-aside pattern for hot endpoints. I also optimized database query indexes on our PostgreSQL instance and implemented connection pooling using Node/TypeScript.\n` +
      `Result: This system architecture optimization successfully reduced average query execution times by 85% and sustained the traffic load without any service degradation.`;
  } else if (q.includes("conflict") || q.includes("team") || q.includes("prioritize") || q.includes("deadline") || q.includes("collaborate") || q.includes("work")) {
    return `Situation: During a critical release cycle for our team, we faced a scope conflict between product roadmap deliverables and critical security patches.\n` +
      `Task: As a ${targetRole}, I had to negotiate with the Product Manager to align priorities without missing the core sprint deployment date.\n` +
      `Action: I organized a technical alignment meeting, presented a breakdown of security risks vs feature value, and proposed a compromise: we deferred two low-priority UI features and fast-tracked the security fixes.\n` +
      `Result: We successfully shipped the core product updates and security patches on time, maintaining both application security and product metrics.`;
  } else if (q.includes("failure") || q.includes("mistake") || q.includes("bug") || q.includes("error") || q.includes("problem") || q.includes("challenge")) {
    return `Situation: Shortly after deploying a major release, we noticed memory leaks in our production logs, which eventually caused the service container to crash.\n` +
      `Task: I needed to identify the root cause of the memory leaks under high stress and restore service availability.\n` +
      `Action: I analyzed memory dumps using Chrome DevTools, traced the issue to uncleaned event listeners in our main React view, and pushed a patch that explicitly cleaned up resources on component unmount.\n` +
      `Result: The service stabilized immediately, memory usage was reduced by 60%, and we established a new ESLint rule to prevent similar memory leak patterns.`;
  } else {
    return `Situation: In a recent project as a ${targetRole}, we needed to improve performance and code quality across our services.\n` +
      `Task: I was responsible for identifying bottlenecks and implementing optimizations within a tight two-week sprint.\n` +
      `Action: I profiled the codebase, restructured inefficient algorithms, updated test suites for coverage, and automated our linting workflow.\n` +
      `Result: Code coverage increased by 15%, load latency decreased by 30%, and the team improved deployment velocity.`;
  }
}

export function evaluateAnswerLocally(
  question: string,
  answer: string,
  targetRole: string,
  difficulty: string
): {
  clarity: number;
  confidence: number;
  relevance: number;
  technicalAccuracy: number;
  communicationQuality: number;
  problemSolving: number;
  completeness: number;
  domainKnowledge: number;
  reasoning: string;
  feedback: string;
  improvedAnswerExample: string;
} {
  const normalizedAnswer = answer.trim().toLowerCase();
  const wordCount = normalizedAnswer.split(/\s+/).filter(Boolean).length;
  
  // 1. Detect filler words
  const fillers = ["um", "uh", "like", "actually", "basically", "you know", "so yeah", "sort of", "kind of"];
  let fillerCount = 0;
  for (const filler of fillers) {
    const regex = new RegExp(`\\b${filler}\\b`, "g");
    const matches = normalizedAnswer.match(regex);
    if (matches) {
      fillerCount += matches.length;
    }
  }
  const fillerDensity = wordCount > 0 ? fillerCount / wordCount : 0;

  // 2. Communication Quality (1-10)
  let communicationQuality = 6;
  if (wordCount < 15) {
    communicationQuality = Math.max(1, Math.round(wordCount / 3));
  } else {
    let lengthBonus = 0;
    if (wordCount >= 50 && wordCount <= 200) lengthBonus = 2;
    else if (wordCount > 200) lengthBonus = 1;
    
    let fillerPenalty = 0;
    if (fillerDensity > 0.1) fillerPenalty = 4;
    else if (fillerDensity > 0.05) fillerPenalty = 2;
    else if (fillerDensity > 0.02) fillerPenalty = 1;

    communicationQuality = Math.max(1, Math.min(10, 6 + lengthBonus - fillerPenalty));
  }

  // 3. Confidence (1-10)
  let confidence = 7;
  if (wordCount < 15) {
    confidence = Math.max(1, Math.round(wordCount / 2));
  } else {
    let fillerPenalty = 0;
    if (fillerDensity > 0.1) fillerPenalty = 4;
    else if (fillerDensity > 0.05) fillerPenalty = 2;
    
    const uncertaintyMarkers = ["i think", "maybe", "not sure", "guess", "probably", "sort of", "kind of", "perhaps"];
    let uncertaintyCount = 0;
    for (const marker of uncertaintyMarkers) {
      const regex = new RegExp(`\\b${marker}\\b`, "g");
      const matches = normalizedAnswer.match(regex);
      if (matches) uncertaintyCount += matches.length;
    }
    const uncertaintyPenalty = Math.min(3, uncertaintyCount);
    
    confidence = Math.max(1, Math.min(10, 8 - fillerPenalty - uncertaintyPenalty));
  }

  // 4. Clarity (1-10)
  let clarity = 6;
  const sentenceCount = answer.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  if (wordCount < 15) {
    clarity = Math.max(1, Math.round(wordCount / 2.5));
  } else {
    const avgSentenceLength = wordCount / (sentenceCount || 1);
    let structureScore = 8;
    if (avgSentenceLength > 30) structureScore -= 2;
    if (avgSentenceLength < 5) structureScore -= 2;
    
    clarity = Math.max(1, Math.min(10, structureScore));
  }

  // 5. Technical Accuracy & Domain Knowledge (1-10)
  const roleLower = targetRole.toLowerCase();
  const techKeywords = [
    "react", "node", "database", "api", "javascript", "typescript", "sql", "nosql", "git", 
    "docker", "aws", "scaling", "cache", "redis", "system", "architecture", "design", 
    "performance", "async", "promise", "security", "algorithm", "optimised", "complexity", 
    "time", "space", "memory", "concurrency", "threading", "rest", "graphql", "mongodb", 
    "postgres", "kubernetes", "cloud", "frontend", "backend", "fullstack", "server", "client", 
    "component", "state", "redux", "hook", "effect", "index", "query", "load", "network", 
    "protocol", "http", "tcp", "dns", "cipher", "encryption"
  ];
  const PM_HR_Keywords = [
    "product", "design", "ux", "ui", "roadmap", "backlog", "agile", "scrum", "sprint", 
    "metric", "kpi", "strategy", "user", "research", "stakeholder", "market", "feedback", 
    "analytics", "team", "collaboration", "conflict", "timeline", "prioritization", "scoping", 
    "customer", "growth", "revenue", "conversion", "retention", "interview", "hiring", 
    "culture", "values", "leadership", "mentoring", "ownership", "okr"
  ];

  const targetKeywords = (roleLower.includes("engineer") || roleLower.includes("developer") || roleLower.includes("tech") || roleLower.includes("coder") || roleLower.includes("architect"))
    ? techKeywords
    : PM_HR_Keywords;

  let keywordMatches = 0;
  const matchedList: string[] = [];
  for (const kw of targetKeywords) {
    const regex = new RegExp(`\\b${kw}(?:s|ed|ing|er)?\\b`, "g");
    const matches = normalizedAnswer.match(regex);
    if (matches) {
      keywordMatches += matches.length;
      matchedList.push(kw);
    }
  }

  let technicalAccuracy = 5;
  let domainKnowledge = 5;
  if (wordCount < 15) {
    technicalAccuracy = Math.max(1, Math.round(wordCount / 3));
    domainKnowledge = Math.max(1, Math.round(wordCount / 3));
  } else {
    let expectedMatches = 2;
    if (difficulty.toLowerCase() === "hard") expectedMatches = 4;
    else if (difficulty.toLowerCase() === "easy") expectedMatches = 1;

    const coverageRatio = keywordMatches / expectedMatches;
    let scoreBase = 5;
    if (coverageRatio >= 1.5) scoreBase = 8;
    else if (coverageRatio >= 1.0) scoreBase = 7;
    else if (coverageRatio >= 0.5) scoreBase = 6;
    else scoreBase = 4;

    if (wordCount > 100) scoreBase += 1;
    if (wordCount > 180) scoreBase += 1;

    technicalAccuracy = Math.max(1, Math.min(10, scoreBase));
    domainKnowledge = Math.max(1, Math.min(10, scoreBase + (keywordMatches >= 1 ? 1 : 0)));
  }

  // 6. Problem Solving (1-10)
  let problemSolving = 5;
  if (wordCount < 15) {
    problemSolving = Math.max(1, Math.round(wordCount / 3));
  } else {
    const reasoningWords = [
      "because", "therefore", "since", "so", "consequently", "resolved", "solved", 
      "optimized", "analyzed", "investigated", "fixed", "tradeoff", "alternative", 
      "reason", "strategy", "impact", "logic", "concurrency", "deadlock", "leak", "bottleneck"
    ];
    let reasoningScore = 0;
    for (const rw of reasoningWords) {
      const regex = new RegExp(`\\b${rw}\\b`, "g");
      const matches = normalizedAnswer.match(regex);
      if (matches) reasoningScore += matches.length;
    }

    let pbBase = 5;
    if (reasoningScore >= 3) pbBase = 8;
    else if (reasoningScore >= 1) pbBase = 7;
    else pbBase = 4;

    if (wordCount > 120) pbBase += 1;

    problemSolving = Math.max(1, Math.min(10, pbBase));
  }

  // 7. Completeness (1-10)
  let completeness = 5;
  if (wordCount < 15) {
    completeness = Math.max(1, Math.round(wordCount / 3));
  } else {
    const starKeywords = [
      "situation", "task", "action", "result", "goal", "outcome", "metric", "kpi", 
      "percent", "increase", "decrease", "reduce", "grow", "deliver", "ship", "collaborate",
      "lead", "achieve", "outperform", "impact", "optimize"
    ];
    let starMatchCount = 0;
    for (const kw of starKeywords) {
      const regex = new RegExp(`\\b${kw}(?:s|ed|ing|ment)?\\b`, "g");
      const matches = normalizedAnswer.match(regex);
      if (matches) starMatchCount += matches.length;
    }

    const metricsCount = (answer.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []).length;

    let completenessScore = 5;
    if (starMatchCount >= 4 && metricsCount >= 1) completenessScore = 8;
    else if (starMatchCount >= 2) completenessScore = 7;
    else if (starMatchCount >= 1) completenessScore = 6;
    else completenessScore = 4;

    if (wordCount > 150) completenessScore += 1;

    completeness = Math.max(1, Math.min(10, completenessScore));
  }

  // 8. Relevance (1-10)
  let relevance = 6;
  if (wordCount < 15) {
    relevance = Math.max(1, Math.round(wordCount / 2.5));
  } else {
    const questionTokens = tokenize(question);
    let overlaps = 0;
    for (const qt of questionTokens) {
      if (normalizedAnswer.includes(qt)) {
        overlaps++;
      }
    }
    
    let relevanceScore = 6;
    if (overlaps >= 3) relevanceScore = 8;
    else if (overlaps >= 1) relevanceScore = 7;
    else relevanceScore = 5;

    relevance = Math.max(1, Math.min(10, relevanceScore));
  }

  const reasoning = `Local evaluation engine analyzed the response text (${wordCount} words). ` +
    `Found ${fillerCount} filler words (${Math.round(fillerDensity * 100)}% density) and ${keywordMatches} relevant keyword matches ` +
    `for target role '${targetRole}'. Overlap with question keywords is ${relevance >= 8 ? 'high' : 'moderate'}. ` +
    `Reasoning indicators score: ${problemSolving >= 8 ? 'high structural logic' : 'basic structural logic'}. ` +
    `STAR method indicators show ${completeness >= 8 ? 'strong impact metrics' : 'room for structural improvement'}.`;

  let feedback = "Answer recorded. ";
  if (wordCount < 30) {
    feedback += "Your response is brief. Try to structure it using the STAR framework (Situation, Task, Action, Result) to provide sufficient depth and context.";
  } else if (fillerDensity > 0.05) {
    feedback += `We detected a high density of filler words (e.g. like, um, basic). Focus on pacing, pause when needed, and express technical details directly.`;
  } else if (keywordMatches === 0) {
    feedback += `To improve, incorporate more role-specific terminology relevant to a ${targetRole} (e.g. design patterns, tools, database optimization, or architectural trade-offs).`;
  } else if (completeness < 7) {
    feedback += `Good effort. Enhance your response by quantifying the impact of your actions (e.g., using percentages, timeline improvements, or team size metrics).`;
  } else {
    feedback += "Excellent structure and technical vocabulary. To further optimize, discuss alternative strategies or tradeoffs you considered.";
  }

  const improvedAnswerExample = generateImprovedExampleLocally(question, targetRole);

  return {
    clarity,
    confidence,
    relevance,
    technicalAccuracy,
    communicationQuality,
    problemSolving,
    completeness,
    domainKnowledge,
    reasoning,
    feedback,
    improvedAnswerExample
  };
}

export function generateInterviewReportLocally(qaHistory: any[]): {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
} {
  if (qaHistory.length === 0) {
    return {
      overallScore: 0,
      strengths: [],
      weaknesses: [],
      recommendations: ["Ensure you attempt and answer the interview questions next time."]
    };
  }

  let totalCommunication = 0;
  let totalTechnical = 0;
  let totalProblemSolving = 0;
  let totalConfidence = 0;
  let totalCompleteness = 0;
  let totalDomainKnowledge = 0;
  let count = 0;

  qaHistory.forEach(q => {
    const f = q.feedback || (q.answer && q.answer.feedback);
    if (f) {
      totalCommunication += f.communicationQuality || f.clarity || 0;
      totalTechnical += f.technicalAccuracy || 0;
      totalProblemSolving += f.problemSolving || f.relevance || 0;
      totalConfidence += f.confidence || 0;
      totalCompleteness += f.completeness || f.clarity || 0;
      totalDomainKnowledge += f.domainKnowledge || f.technicalAccuracy || 0;
      count++;
    }
  });

  const divisor = count || 1;
  const communication = totalCommunication / divisor;
  const technicalAccuracy = totalTechnical / divisor;
  const problemSolving = totalProblemSolving / divisor;
  const confidence = totalConfidence / divisor;
  const completeness = totalCompleteness / divisor;
  const domainKnowledge = totalDomainKnowledge / divisor;

  const overallScore = Math.round(((communication + technicalAccuracy + problemSolving + confidence + completeness + domainKnowledge) / 6) * 10) / 10;

  const categories = [
    { name: "Communication Quality", score: communication, desc: "vocal articulation and flow" },
    { name: "Technical Accuracy", score: technicalAccuracy, desc: "precision of technical answers" },
    { name: "Problem Solving", score: problemSolving, desc: "depth of reasoning and logic" },
    { name: "Confidence", score: confidence, desc: "clarity and verbal structure" },
    { name: "Completeness", score: completeness, desc: "use of structured impact metrics" },
    { name: "Domain Knowledge", score: domainKnowledge, desc: "role-specific expertise" }
  ];

  const sorted = [...categories].sort((a, b) => b.score - a.score);
  const topCategories = sorted.slice(0, 2);
  const bottomCategories = sorted.slice(-2).reverse();

  const strengths = topCategories.map(cat => 
    `Strong performance in ${cat.name} (${Math.round(cat.score * 10) / 10}/10), demonstrating good ${cat.desc}.`
  );
  const weaknesses = bottomCategories.map(cat => 
    `Needs improvement in ${cat.name} (${Math.round(cat.score * 10) / 10}/10), specifically in terms of ${cat.desc}.`
  );

  const recommendations = [
    "Practice structure by using the STAR (Situation, Task, Action, Result) method in responses.",
    "Refine technical terminology and provide more metrics to support claims.",
    "Do more mock interviews to practice verbal confidence and pace."
  ];

  return {
    overallScore,
    strengths,
    weaknesses,
    recommendations
  };
}

export async function evaluateInterviewAnswer(
  question: string,
  answer: string,
  targetRole: string,
  difficulty: string
): Promise<{
  clarity: number;
  confidence: number;
  relevance: number;
  technicalAccuracy: number;
  communicationQuality: number;
  problemSolving: number;
  completeness: number;
  domainKnowledge: number;
  reasoning: string;
  feedback: string;
  improvedAnswerExample: string;
}> {
  if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
    return evaluateAnswerLocally(question, answer, targetRole, difficulty);
  }

  const prompt = [
    `Evaluate the candidate's answer to the following question.`,
    `Question: ${question}`,
    `Answer: ${answer}`,
    `Target Role: ${targetRole}`,
    `Difficulty: ${difficulty}`,
    `CRITICAL INSTRUCTION: You must evaluate the actual answer text provided by the candidate. Do not use generic template feedback.`,
    `If the candidate gave a very short, incorrect, incomplete, or evasive answer, reflect this by giving low scores (1-4) in relevant categories (e.g. technicalAccuracy, completeness, domainKnowledge, problemSolving).`,
    `Your feedback must directly point out specific omissions or mistakes in their actual words (e.g. "You stated X, but did not explain how it works or mention key concept Y").`,
    `Provide a score on a 1-10 scale for:`,
    `- clarity (structural clarity, flow)`,
    `- confidence (presence, phrasing)`,
    `- relevance (directly answering the question)`,
    `- technicalAccuracy (accuracy of engineering or factual claims)`,
    `- communicationQuality (overall clarity, vocabulary, verbal structure)`,
    `- problemSolving (logic, depth of analysis, systematic troubleshooting)`,
    `- completeness (whether they answered all parts of the question, e.g. using STAR)`,
    `- domainKnowledge (expertise in the target role domain)`,
    `Also provide:`,
    `- reasoning (the logical explanation of how these scores were derived from the actual text of the answer)`,
    `- feedback (brief, constructive feedback on how to improve)`,
    `- improvedAnswerExample (a highly detailed, specific example answer written in the STAR framework that would score 10/10 for this question)`,
    `Return strict JSON only matching this format:`,
    `{`,
    `  "clarity": number,`,
    `  "confidence": number,`,
    `  "relevance": number,`,
    `  "technicalAccuracy": number,`,
    `  "communicationQuality": number,`,
    `  "problemSolving": number,`,
    `  "completeness": number,`,
    `  "domainKnowledge": number,`,
    `  "reasoning": "string",`,
    `  "feedback": "string",`,
    `  "improvedAnswerExample": "string"`,
    `}`
  ].join("\n");

  try {
    const response = await requestGeminiJson(prompt, 0.3);
    if (!response.ok) {
      return evaluateAnswerLocally(question, answer, targetRole, difficulty);
    }
    
    const responseJson = await response.json();
    const outputText = extractGeminiText(responseJson);
    const parsed = safeJsonParse(outputText) as any;
    return {
      clarity: Number(parsed.clarity ?? 6),
      confidence: Number(parsed.confidence ?? 6),
      relevance: Number(parsed.relevance ?? 6),
      technicalAccuracy: Number(parsed.technicalAccuracy ?? 6),
      communicationQuality: Number(parsed.communicationQuality ?? parsed.clarity ?? 6),
      problemSolving: Number(parsed.problemSolving ?? parsed.relevance ?? 6),
      completeness: Number(parsed.completeness ?? parsed.clarity ?? 6),
      domainKnowledge: Number(parsed.domainKnowledge ?? parsed.technicalAccuracy ?? 6),
      reasoning: String(parsed.reasoning ?? "Derivation based on response patterns."),
      feedback: String(parsed.feedback ?? "Ensure your answer clearly addresses the core of the question."),
      improvedAnswerExample: String(parsed.improvedAnswerExample ?? "")
    };
  } catch (e) {
    return evaluateAnswerLocally(question, answer, targetRole, difficulty);
  }
}

export async function generateInterviewReport(qaHistory: any[]): Promise<{ overallScore: number; strengths: string[]; weaknesses: string[]; recommendations: string[] }> {
  if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
    return generateInterviewReportLocally(qaHistory);
  }

  const prompt = [
    `The interview session is complete. Review the array of questions and the candidate's answers, along with their individual evaluation scores and feedback.`,
    `Generate a comprehensive final report.`,
    `CRITICAL INSTRUCTION: This report must be constructed ONLY from the actual Q&A history. Do NOT use generic template text or placeholder feedback.`,
    `Requirements:`,
    `- overallScore: A realistic aggregate rating out of 10. Do NOT generate a random score. Base it on the mathematical performance of the candidate across the questions they answered, penalizing them heavily for skipped or poorly answered questions.`,
    `- strengths: An array of 2-3 specific strengths. Each strength MUST reference a specific example or quote from the candidate's answers (e.g. "Demonstrated strong knowledge of database optimization when discussing indexing strategy..."). If they did not demonstrate any notable strengths, state that clearly and construct positive feedback around areas they started to grasp.`,
    `- weaknesses: An array of 2-3 areas for improvement. Each area MUST reference a specific example or quote from the candidate's answers where they were vague, incorrect, or incomplete (e.g., "In Question 2, when asked about React state, the candidate's answer was limited to a single brief sentence without details...").`,
    `- recommendations: An array of 3-4 actionable next steps, listing specific skills to improve, concrete learning resources (articles, courses, books), and practice advice.`,
    `Return strict JSON only matching this format:`,
    `{ "overallScore": number, "strengths": ["string"], "weaknesses": ["string"], "recommendations": ["string"] }`,
    `Q&A HISTORY:\n${JSON.stringify(qaHistory)}`
  ].join("\n");

  try {
    const response = await requestGeminiJson(prompt, 0.3);
    if (!response.ok) {
      return generateInterviewReportLocally(qaHistory);
    }

    const responseJson = await response.json();
    const outputText = extractGeminiText(responseJson);
    const parsed = safeJsonParse(outputText) as any;
    return {
      overallScore: Number(parsed.overallScore ?? 6),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : ["Attempted all questions"],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : ["Unable to generate detailed analysis"],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : ["Review your answers"]
    };
  } catch (e) {
    return generateInterviewReportLocally(qaHistory);
  }
}
