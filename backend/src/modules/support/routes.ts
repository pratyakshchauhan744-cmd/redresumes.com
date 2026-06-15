import { Router } from "express";
import { handleContactSupport } from "./controller.js";

const router = Router();

router.post("/contact", handleContactSupport);

export default router;
