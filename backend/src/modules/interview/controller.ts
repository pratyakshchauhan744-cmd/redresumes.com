import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createRequire } from "module";
const require = createRequire(import.meta.url); // Forcing restart
const pdfParse = require("pdf-parse");
import { prisma } from "../../db/prisma.js";
import { parseResumeWithGemini } from "../ai/service.js";
import { createInterviewSession, answerInterviewQuestion, completeSessionAndGenerateReport } from "./service.js";

const startSessionSchema = z.object({
  resumeId: z.string(),
  targetRole: z.string(),
  companyType: z.string(),
  difficulty: z.string(),
  style: z.string(),
  durationMins: z.coerce.number().min(5).max(60),
  jobDescription: z.string().optional(),
  interviewerPersona: z.string().optional(),
  stressMode: z.boolean().optional()
});

const answerSchema = z.object({
  sessionId: z.string(),
  questionId: z.string(),
  answerText: z.string(),
  wpm: z.number().optional(),
  fillerCount: z.number().optional(),
  confidence: z.number().optional(),
  durationSecs: z.number().optional()
});

export async function uploadAndParseResume(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;

    if (!req.file) {
      return res.status(400).json({ message: "No resume file uploaded" });
    }

    let parsedText = "";
    if (req.file.mimetype === "application/pdf") {
      const data = await pdfParse(req.file.buffer);
      parsedText = data.text;
    } else {
      parsedText = req.file.buffer.toString('utf-8'); 
    }

    // Strip null bytes — Postgres text columns reject \u0000
    parsedText = parsedText.replace(/\u0000/g, '');

    const structuredData = await parseResumeWithGemini(parsedText);

    if (structuredData.isResume === false) {
      return res.status(400).json({
        message: "The uploaded file does not appear to be a valid resume or CV.",
        error: "The uploaded file does not appear to be a valid resume or CV."
      });
    }

    const resume = await prisma.resume.create({
      data: {
        userId: userId || null,
        fileName: req.file.originalname,
        parsedData: structuredData
      }
    });

    res.json({ resumeId: resume.id, parsedData: structuredData });
  } catch (err) {
    next(err);
  }
}

export async function startInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;

    const payload = startSessionSchema.parse(req.body);

    if (userId) {
      // 1. Prevent duplicate charges: check if an active session already exists
      const activeSession = await prisma.interviewSession.findFirst({
        where: {
          userId,
          status: "in_progress"
        },
        include: {
          questions: {
            orderBy: { orderIndex: "asc" }
          }
        }
      });

      if (activeSession) {
        const lastQuestion = activeSession.questions[activeSession.questions.length - 1];
        if (lastQuestion) {
          console.log(`Resuming active session ${activeSession.id} to avoid duplicate credit deduction.`);
          return res.json({
            sessionId: activeSession.id,
            firstQuestion: {
              id: lastQuestion.id,
              text: lastQuestion.questionText
            }
          });
        }
      }

      // 2. Validate credits before starting
      const userCredit = await prisma.userCredit.findUnique({
        where: { userId }
      });

      if (!userCredit || userCredit.balance <= 0) {
        return res.status(402).json({ message: "You have no interview credits remaining." });
      }
    }

    const result = await createInterviewSession(
      userId || null,
      payload.resumeId,
      payload.targetRole,
      payload.companyType,
      payload.difficulty,
      payload.style,
      payload.durationMins,
      payload.jobDescription,
      payload.interviewerPersona,
      payload.stressMode
    );

    res.json({
      sessionId: result.session.id,
      firstQuestion: {
        id: result.firstQuestion.id,
        text: result.firstQuestion.questionText
      }
    });
  } catch (err: any) {
    if (err.message === "You have no interview credits remaining.") {
      return res.status(402).json({ message: err.message });
    }
    next(err);
  }
}

export async function answerQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = answerSchema.parse(req.body);

    const result = await answerInterviewQuestion(
      payload.sessionId,
      payload.questionId,
      payload.answerText,
      payload.wpm,
      payload.fillerCount,
      payload.confidence,
      payload.durationSecs
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSessionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;

    const session = await prisma.interviewSession.findUnique({
      where: { id: req.params.id },
      include: { questions: { include: { answer: true } } }
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    // Only block if the session is owned by someone else and we are not that user
    if (session.userId && session.userId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(session);
  } catch (err) {
    next(err);
  }
}

export async function getReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    const sessionId = req.params.id;

    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { questions: { include: { answer: true } } }
    });

    if (!session) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (session.userId && session.userId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const answeredQuestions = session.questions.filter(q => q.answer);
    const totalAnswerLength = answeredQuestions.reduce((sum, q) => sum + (q.answer?.answerText?.trim().length || 0), 0);

    if (answeredQuestions.length === 0 || totalAnswerLength < 15) {
      return res.status(422).json({ message: "No interview data available." });
    }

    let report = await prisma.interviewReport.findUnique({
      where: { sessionId },
      include: {
        session: {
          include: { questions: { include: { answer: true } } }
        }
      }
    });

    if (!report) {
      // Session has sufficient data, let's complete and generate report now
      try {
        const generated = await completeSessionAndGenerateReport(sessionId);
        if (!generated) {
          return res.status(422).json({ message: "No interview data available." });
        }
        report = await prisma.interviewReport.findUnique({
          where: { sessionId },
          include: {
            session: {
              include: { questions: { include: { answer: true } } }
            }
          }
        });
      } catch (err) {
        return res.status(422).json({ message: "No interview data available." });
      }
    }

    res.json(report);
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const sessions = await prisma.interviewSession.findMany({
      where: { userId, status: "completed" },
      orderBy: { createdAt: "desc" },
      include: {
        report: true
      }
    });

    res.json(sessions);
  } catch (err) {
    next(err);
  }
}

export async function completeInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { wpm, fillerCount, confidence } = req.body;

    const report = await completeSessionAndGenerateReport(id, wpm, fillerCount, confidence);
    res.json(report);
  } catch (err) {
    next(err);
  }
}
