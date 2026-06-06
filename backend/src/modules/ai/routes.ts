import { Router } from "express";
import { z } from "zod";
import { analyzeAtsScore, improveResumeWithGemini, translateResumeWithGemini, parseResumeWithGemini } from "./service.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const atsSchema = z.object({
  resumeText: z.string().min(30),
  jobDescription: z.string().min(30)
});

const improveSchema = z.object({
  resumeText: z.string().min(30),
  jobDescription: z.string().optional(),
  jobTitle: z.string().optional(),
  focus: z.enum(["summary", "bullets", "full"]).default("full")
});

const translateResumeSchema = z.object({
  targetLanguage: z.enum(["English", "Hindi", "Spanish", "French"]),
  resume: z.object({
    jobTitle: z.string(),
    location: z.string(),
    summary: z.string(),
    experiences: z.array(
      z.object({
        title: z.string(),
        dates: z.string(),
        bullets: z.array(z.string())
      })
    ),
    projects: z.array(z.string()),
    certifications: z.array(z.string()),
    languages: z.array(z.string()),
    achievements: z.array(z.string()),
    volunteer: z.array(z.string()),
    skills: z.array(z.string()),
    hobbies: z.array(z.string())
  })
});

router.post("/ats-score", async (req, res, next) => {
  try {
    const body = atsSchema.parse(req.body);
    const analysis = analyzeAtsScore(body.resumeText, body.jobDescription);
    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

router.post("/improve-resume", async (req, res, next) => {
  try {
    const body = improveSchema.parse(req.body);
    const result = await improveResumeWithGemini({
      resumeText: body.resumeText,
      jobDescription: body.jobDescription,
      jobTitle: body.jobTitle,
      focus: body.focus
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/translate-resume", async (req, res, next) => {
  try {
    const body = translateResumeSchema.parse(req.body);
    const result = await translateResumeWithGemini({
      targetLanguage: body.targetLanguage,
      resume: {
        jobTitle: body.resume.jobTitle,
        location: body.resume.location,
        summary: body.resume.summary,
        experiences: body.resume.experiences.map((item) => ({
          title: item.title,
          dates: item.dates,
          bullets: item.bullets
        })),
        projects: body.resume.projects,
        certifications: body.resume.certifications,
        languages: body.resume.languages,
        achievements: body.resume.achievements,
        volunteer: body.resume.volunteer,
        skills: body.resume.skills,
        hobbies: body.resume.hobbies
      }
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

import multer from "multer";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/parse-resume", upload.single("resume"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No resume file provided." });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Only PDF files are supported at this time." });
    }

    import { createRequire } from "module";
    const require = createRequire(import.meta.url);
    const pdfParse = require("pdf-parse");
    const result = await pdfParse(req.file.buffer);
    const parsedResume = await parseResumeWithGemini(result.text);
    
    res.json(parsedResume);
  } catch (error) {
    next(error);
  }
});

export default router;
