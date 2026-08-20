import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";

const router = Router();

const resumeDataSchema = z.object({
  fullName: z.string().optional(),
  jobTitle: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  profileLink: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(z.string()).optional(),
  educationItems: z.array(z.object({
    degree: z.string(),
    school: z.string(),
    year: z.string()
  })).optional(),
  educationDegree: z.string().optional(),
  educationSchool: z.string().optional(),
  educationYear: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  experiences: z.array(z.object({
    title: z.string(),
    dates: z.string(),
    bullets: z.union([z.string(), z.array(z.string())])
  })).optional(),
  projects: z.array(z.string()).optional(),
  projectsDisplay: z.enum(["paragraph", "list"]).optional(),
  certifications: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  hobbies: z.array(z.string()).optional(),
  achievements: z.array(z.string()).optional(),
  volunteer: z.array(z.string()).optional(),
  listStyle: z.enum(["bullet", "number"]).optional(),
  customColumns: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string()
  })).optional()
}).passthrough();

const publishResumeSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  templateId: z.string().min(1).max(80),
  resumeData: resumeDataSchema
});

function createPublicResumeId(slug: string) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug.slice(0, 48)}-${suffix}`;
}

router.post("/", async (req, res, next) => {
  try {
    const data = publishResumeSchema.parse(req.body);
    const id = createPublicResumeId(data.slug);

    const created = await prisma.publicResume.create({
      data: {
        id,
        slug: data.slug,
        templateId: data.templateId,
        resumeData: data.resumeData as any
      }
    });

    res.status(201).json({
      id: created.id,
      slug: created.slug,
      templateId: created.templateId,
      resumeData: created.resumeData
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const resume = await prisma.publicResume.findUnique({
      where: { id: req.params.id }
    });

    if (!resume) {
      res.status(404).json({ message: "Shared resume not found." });
      return;
    }

    res.json({
      id: resume.id,
      slug: resume.slug,
      templateId: resume.templateId,
      resumeData: resume.resumeData,
      updatedAt: resume.updatedAt
    });
  } catch (error) {
    next(error);
  }
});

export default router;
