import { prisma } from "../../db/prisma.js";
import { parseResumeWithGemini, generateInterviewQuestion, generateInterviewFollowUp, evaluateInterviewAnswer, generateInterviewReport } from "../ai/service.js";

export async function createInterviewSession(
  userId: string | null,
  resumeId: string,
  targetRole: string,
  companyType: string,
  difficulty: string,
  interviewStyle: string,
  durationMins: number,
  jobDescription?: string,
  interviewerPersona?: string,
  stressMode?: boolean
) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw new Error("Resume not found");

  // Execute credit check and session creation inside a single transaction
  const session = await prisma.$transaction(async (tx) => {
    if (userId) {
      const userCredit = await tx.userCredit.findUnique({
        where: { userId }
      });

      if (!userCredit || userCredit.balance <= 0) {
        throw new Error("You have no interview credits remaining.");
      }
    }

    return tx.interviewSession.create({
      data: {
        userId,
        resumeId,
        targetRole,
        companyType,
        difficulty,
        interviewStyle,
        durationMins,
        jobDescription,
        interviewerPersona,
        stressMode,
        creditUsed: false
      }
    });
  });

  const firstQuestionText = await generateInterviewQuestion(
    resume.parsedData,
    targetRole,
    companyType,
    difficulty,
    interviewStyle,
    jobDescription,
    interviewerPersona,
    stressMode
  );

  const firstQuestion = await prisma.interviewQuestion.create({
    data: {
      sessionId: session.id,
      questionText: firstQuestionText,
      questionType: "base",
      orderIndex: 1
    }
  });

  return { session, firstQuestion };
}

export async function answerInterviewQuestion(
  sessionId: string,
  questionId: string,
  answerText: string,
  wpm?: number,
  fillerCount?: number,
  confidence?: number,
  durationSecs?: number
) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: { questions: { include: { answer: true } }, resume: true }
  });
  if (!session) throw new Error("Session not found");

  const currentQuestion = session.questions.find(q => q.id === questionId);
  if (!currentQuestion) throw new Error("Question not found in this session");

  const evaluation = await evaluateInterviewAnswer(
    currentQuestion.questionText,
    answerText,
    session.targetRole,
    session.difficulty
  );

  const answerScore = Math.round(
    ((evaluation.communicationQuality +
      evaluation.technicalAccuracy +
      evaluation.problemSolving +
      evaluation.confidence +
      evaluation.completeness +
      evaluation.domainKnowledge) / 6) * 10
  ) / 10;

  await prisma.interviewAnswer.create({
    data: {
      questionId,
      answerText,
      score: answerScore, 
      feedback: evaluation,
      durationSecs: durationSecs || null
    }
  });

  // Calculate if we reached the duration limit or a fixed number of questions (e.g. 5)
  const maxQuestions = 5; 
  const answeredCount = session.questions.filter(q => q.answer).length + 1;

  if (answeredCount >= maxQuestions) {
    await completeSessionAndGenerateReport(sessionId, wpm, fillerCount, confidence);
    return { isComplete: true, reportId: sessionId };
  } else {
    // Generate Follow-up with full history
    const qaHistory = session.questions
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(q => {
        if (q.id === questionId) {
          return {
            questionText: q.questionText,
            answerText: answerText,
            questionType: q.questionType
          };
        }
        return {
          questionText: q.questionText,
          answerText: q.answer?.answerText || undefined,
          questionType: q.questionType
        };
      });

    const nextQuestionText = await generateInterviewFollowUp(
      qaHistory,
      session.resume.parsedData,
      session.jobDescription || undefined,
      session.interviewerPersona || undefined,
      session.stressMode || undefined
    );

    const nextQuestion = await prisma.interviewQuestion.create({
      data: {
        sessionId,
        questionText: nextQuestionText,
        questionType: "followup",
        orderIndex: answeredCount + 1
      }
    });

    return { isComplete: false, nextQuestion };
  }
}

export async function completeSessionAndGenerateReport(
  sessionId: string,
  wpm?: number,
  fillerCount?: number,
  confidence?: number
) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: { questions: { include: { answer: true } } }
  });
  if (!session) throw new Error("Session not found");

  const answeredQuestions = session.questions.filter(q => q.answer);
  const totalAnswerLength = answeredQuestions.reduce((sum, q) => sum + (q.answer?.answerText?.trim().length || 0), 0);

  if (answeredQuestions.length === 0 || totalAnswerLength < 15) {
    // Insufficient data! Just complete session without generating report record
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { status: "completed" }
    });
    await prisma.interviewReport.deleteMany({
      where: { sessionId }
    });
    return null;
  }

  const qaHistory = answeredQuestions.map(q => ({
    question: q.questionText,
    answer: q.answer?.answerText,
    feedback: q.answer?.feedback
  }));

  const report = await generateInterviewReport(qaHistory);

  // Calculate average scores from answered questions
  let avgClarity = 0;
  let avgConfidence = 0;
  let avgRelevance = 0;
  let avgTechnicalAccuracy = 0;
  let avgCommunicationQuality = 0;
  let avgProblemSolving = 0;
  let avgCompleteness = 0;
  let avgDomainKnowledge = 0;

  answeredQuestions.forEach(q => {
    const feedback = q.answer?.feedback as any;
    if (feedback) {
      avgClarity += feedback.clarity || 0;
      avgConfidence += feedback.confidence || 0;
      avgRelevance += feedback.relevance || 0;
      avgTechnicalAccuracy += feedback.technicalAccuracy || 0;
      avgCommunicationQuality += feedback.communicationQuality || feedback.clarity || 0;
      avgProblemSolving += feedback.problemSolving || feedback.relevance || 0;
      avgCompleteness += feedback.completeness || feedback.clarity || 0;
      avgDomainKnowledge += feedback.domainKnowledge || feedback.technicalAccuracy || 0;
    }
  });

  const count = answeredQuestions.length;
  const categoryScores = {
    clarity: count > 0 ? Math.round((avgClarity / count) * 10) / 10 : 0,
    confidence: count > 0 ? Math.round((avgConfidence / count) * 10) / 10 : 0,
    relevance: count > 0 ? Math.round((avgRelevance / count) * 10) / 10 : 0,
    technicalAccuracy: count > 0 ? Math.round((avgTechnicalAccuracy / count) * 10) / 10 : 0,
    communicationQuality: count > 0 ? Math.round((avgCommunicationQuality / count) * 10) / 10 : 0,
    problemSolving: count > 0 ? Math.round((avgProblemSolving / count) * 10) / 10 : 0,
    completeness: count > 0 ? Math.round((avgCompleteness / count) * 10) / 10 : 0,
    domainKnowledge: count > 0 ? Math.round((avgDomainKnowledge / count) * 10) / 10 : 0
  };

  const overallScore = count > 0 ? Math.round(((
    categoryScores.communicationQuality +
    categoryScores.technicalAccuracy +
    categoryScores.problemSolving +
    categoryScores.confidence +
    categoryScores.completeness +
    categoryScores.domainKnowledge
  ) / 6) * 10) / 10 : 0;

  // Delete existing report if any to prevent duplicate primary key/unique constraint error
  await prisma.interviewReport.deleteMany({
    where: { sessionId }
  });

  // Deduct credit if not already deducted and userId exists
  let creditDeducted = false;
  if (session.userId && !session.creditUsed) {
    try {
      await prisma.$transaction(async (tx) => {
        const userCredit = await tx.userCredit.findUnique({
          where: { userId: session.userId! }
        });
        if (userCredit && userCredit.balance > 0) {
          await tx.userCredit.update({
            where: { userId: session.userId! },
            data: { balance: { decrement: 1 } }
          });
          creditDeducted = true;
        }
      });
    } catch (txErr) {
      console.error("Failed to deduct interview credit on completion:", txErr);
    }
  }

  const createdReport = await prisma.interviewReport.create({
    data: {
      sessionId,
      overallScore: overallScore,
      categoryScores,
      strengths: report?.strengths || ["Completed the interview successfully."],
      weaknesses: report?.weaknesses || ["Needs more practice with structural clarity."],
      recommendations: report?.recommendations || ["Use STAR method", "Practice more mock interviews"],
      speakingPace: wpm || 135,
      fillerWords: fillerCount || 0,
      voiceConfidence: confidence || 80
    }
  });

  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { 
      status: "completed",
      creditUsed: session.creditUsed || creditDeducted
    }
  });

  return createdReport;
}
