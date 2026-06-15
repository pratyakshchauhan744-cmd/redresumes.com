import type { Request, Response, RequestHandler } from "express";
import nodemailer from "nodemailer";
import { z } from "zod";
import { env } from "../../config/env.js";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  message: z.string().min(10, "Message must be at least 10 characters long")
});

export const handleContactSupport: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid form data", details: parsed.error.format() });
      return;
    }

    const { name, email, message } = parsed.data;

    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      console.warn("SMTP credentials not configured. Returning success without sending email.");
      // Just simulate success if no SMTP is configured so frontend doesn't break
      res.status(200).json({ success: true, message: "Support request recorded (Simulation)." });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? false,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: env.EMAIL_FROM || `"RedResumes Support" <no-reply@redresumes.com>`,
      to: env.EMAIL_FROM || "support@redresumes.com", // send to admin
      replyTo: email,
      subject: `RedResumes Support Request from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: `
        <h2>New Support Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong><br/>${message.replace(/\\n/g, "<br/>")}</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: "Your message has been sent successfully." });
  } catch (error) {
    console.error("Error sending support email:", error);
    res.status(500).json({ error: "Failed to send message. Please try again later." });
  }
};
