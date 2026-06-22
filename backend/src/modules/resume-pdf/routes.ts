import { Router } from "express";
import { z } from "zod";

const router = Router();

type PdfPage = {
  evaluate<T>(pageFunction: () => T | Promise<T>): Promise<T>;
  setContent(html: string, options?: { waitUntil?: string | string[]; timeout?: number }): Promise<void>;
  emulateMediaType(type: "print"): Promise<void>;
  pdf(options: Record<string, unknown>): Promise<Uint8Array>;
};

type PdfBrowser = {
  newPage(): Promise<PdfPage>;
  close(): Promise<void>;
};

const pdfRequestSchema = z.object({
  html: z.string().min(1).max(10 * 1024 * 1024),
  fileName: z.string().min(1).max(180).default("resume.pdf"),
});

const sanitizeFileName = (value: string): string => {
  const normalized = value.replace(/[/\\?%*:|"<>]/g, "-").trim();
  return normalized.toLowerCase().endsWith(".pdf") ? normalized : `${normalized || "resume"}.pdf`;
};

const getPdfScale = async (page: PdfPage): Promise<number> => {
  return page.evaluate(() => {
    const content =
      document.querySelector<HTMLElement>(".resume") ??
      document.querySelector<HTMLElement>(".resume-pdf-fit") ??
      document.body;
    const contentHeight = Math.max(content.scrollHeight, content.getBoundingClientRect().height);
    const printableA4HeightPx = (297 - 24) * (96 / 25.4) * 0.98;

    if (!contentHeight || contentHeight <= printableA4HeightPx) {
      return 1;
    }

    return Math.max(0.72, Math.min(1, printableA4HeightPx / contentHeight));
  });
};

router.post("/pdf", async (req, res, next) => {
  let browser: PdfBrowser | undefined;

  try {
    const body = pdfRequestSchema.parse(req.body);
    const isVercelRuntime = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

    if (isVercelRuntime) {
      const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
        import("@sparticuz/chromium"),
        import("puppeteer-core"),
      ]);

      const viewport = {
        deviceScaleFactor: 1,
        hasTouch: false,
        height: 1080,
        isLandscape: false,
        isMobile: false,
        width: 1440,
      };

      browser = await puppeteer.launch({
        args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
        defaultViewport: viewport,
        executablePath: await chromium.executablePath(),
        headless: "shell",
      });
    } else {
      const { default: puppeteer } = await import("puppeteer");

      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--font-render-hinting=none",
        ],
      });
    }

    if (!browser) {
      throw new Error("Could not start PDF browser");
    }

    const page = await browser.newPage();
    await page.setContent(body.html, { waitUntil: ["load", "networkidle0"], timeout: 30_000 });
    await page.emulateMediaType("print");
    const pdfScale = await getPdfScale(page);

    const pdf = await page.pdf({
      format: "A4",
      scale: pdfScale,
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
      margin: {
        top: "12mm",
        right: "12mm",
        bottom: "12mm",
        left: "12mm",
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFileName(body.fileName)}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(pdf));
  } catch (error) {
    next(error);
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
});

export default router;
