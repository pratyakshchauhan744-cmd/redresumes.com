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
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { env } from "./config/env.js";

export const app = express();
app.set("trust proxy", 1);

const explicitOrigins = (env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (explicitOrigins.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
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
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "redresumes-backend" });
});

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

app.use(notFoundHandler);
app.use(errorHandler);
