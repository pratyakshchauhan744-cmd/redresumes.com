import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth.js";
import { uploadAndParseResume, startInterview, answerQuestion, getSessionStatus, getReport, getHistory, completeInterview } from "./controller.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post("/resume/analyze", requireAuth, upload.single("resume"), uploadAndParseResume);
router.post("/start", requireAuth, startInterview);
router.post("/answer", requireAuth, answerQuestion);
router.post("/session/:id/complete", requireAuth, completeInterview);
router.get("/session/:id", requireAuth, getSessionStatus);
router.get("/report/:id", requireAuth, getReport);
router.get("/history", requireAuth, getHistory);

export default router;
