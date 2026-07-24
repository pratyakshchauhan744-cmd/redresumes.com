import { Resend } from "resend";
import { env } from "../config/env.js";

/**
 * Single Resend client instance for the entire backend.
 * The RESEND_API_KEY env var must be set and the sending domain
 * (redresumes.com) must be verified in the Resend dashboard with
 * valid SPF/DKIM/DMARC records before any send will succeed.
 */
export const resend = new Resend(env.RESEND_API_KEY);
