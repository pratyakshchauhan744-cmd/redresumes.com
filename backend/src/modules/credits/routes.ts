import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { createCheckoutSession, handleRazorpayWebhook, getTransactions, devAddCredits } from "./controller.js";

const router = Router();

// Public webhook route (signature verified internally)
router.post("/webhook", handleRazorpayWebhook);

// Protected routes
router.post("/checkout", requireAuth, createCheckoutSession);
router.get("/transactions", requireAuth, getTransactions);
router.post("/dev-add", requireAuth, devAddCredits);

export default router;
