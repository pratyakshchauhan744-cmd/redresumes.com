import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/routes.js";
import jobsRoutes from "./modules/jobs/routes.js";
import companiesRoutes from "./modules/companies/routes.js";
import applicationsRoutes from "./modules/applications/routes.js";
import savedJobsRoutes from "./modules/saved-jobs/routes.js";
import employerRoutes from "./modules/employer/routes.js";
import usersRoutes from "./modules/users/routes.js";
import ingestionRoutes from "./modules/ingestion/routes.js";
import adminRoutes from "./modules/admin/routes.js";
import aiRoutes from "./modules/ai/routes.js";
import publicResumeRoutes from "./modules/public-resumes/routes.js";
import resumePdfRoutes from "./modules/resume-pdf/routes.js";
import devRoutes from "./modules/dev/routes.js";
import interviewRoutes from "./modules/interview/routes.js";
import creditsRoutes from "./modules/credits/routes.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { env } from "./config/env.js";

export const app = express();
app.set("trust proxy", 1);

const explicitOrigins = (env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedCorsOrigin(origin: string): boolean {
  if (explicitOrigins.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }

  if (env.NODE_ENV !== "production" && origin === "https://accounts.google.com") {
    return true;
  }

  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return (
      hostname === "redresumes.com" ||
      hostname === "www.redresumes.com" ||
      hostname === "redresumescom.vercel.app" ||
      /^redresumes-[a-z0-9-]+-krishchauhan2808-2544s-projects\.vercel\.app$/.test(hostname)
    );
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS blocked for this origin"));
    },
    credentials: true
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use("/api/credits/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "redresumes-backend" });
});

if (env.NODE_ENV !== "production") {
  app.get("/", (_req, res) => {
    res.redirect("/api/dev");
  });
  app.use("/api/dev", devRoutes);
}

import supportRoutes from "./modules/support/routes.js";

app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/companies", companiesRoutes);
app.use("/api", applicationsRoutes);
app.use("/api", savedJobsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/employer", employerRoutes);
app.use("/api/ingestion", ingestionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/public-resumes", publicResumeRoutes);
app.use("/api/resume", resumePdfRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/credits", creditsRoutes);
app.use("/api/support", supportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
