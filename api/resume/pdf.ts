import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

const sanitizePdfFileName = (value: string) => {
  const normalized = value.replace(/[/\\?%*:|"<>]/g, "-").trim();
  return normalized.toLowerCase().endsWith(".pdf") ? normalized : `${normalized || "resume"}.pdf`;
};

const getPdfScale = async (page: any): Promise<number> => {
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

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed. Use POST." });
    return;
  }

  let browser: any;
  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // Keep as is
      }
    }

    if (!body || typeof body.html !== "string" || !body.html.trim()) {
      res.status(400).json({ message: "Resume HTML is required." });
      return;
    }

    const html = body.html;
    const fileName = String(body.fileName || "resume.pdf");

    const viewport = {
      deviceScaleFactor: 1,
      hasTouch: false,
      height: 1080,
      isLandscape: false,
      isMobile: false,
      width: 1440,
    };

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: viewport,
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });

    const page = await browser.newPage();

    if (typeof page.setUserAgent === "function") {
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      );
    }

    await page.setJavaScriptEnabled(false);

    await page.setRequestInterception(true);
    page.on("request", (interceptedRequest: any) => {
      const url = interceptedRequest.url().toLowerCase();
      if (url.startsWith("file:") || url.startsWith("chrome:") || url.startsWith("chrome-extension:")) {
        interceptedRequest.abort();
        return;
      }
      try {
        const parsedUrl = new URL(interceptedRequest.url());
        const hostname = parsedUrl.hostname.toLowerCase();
        if (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "[::1]" ||
          hostname === "::1" ||
          hostname === "169.254.169.254"
        ) {
          interceptedRequest.abort();
          return;
        }
      } catch {
        interceptedRequest.abort();
        return;
      }
      interceptedRequest.continue();
    });

    await page.setContent(html, { waitUntil: ["load", "networkidle0"], timeout: 30_000 });
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

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizePdfFileName(fileName)}"`);
    res.setHeader("Cache-Control", "no-store");
    if (typeof res.send === "function") {
      res.send(Buffer.from(pdf));
    } else {
      res.end(Buffer.from(pdf));
    }
  } catch (error: any) {
    console.error("Vercel PDF generation error:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Unable to generate PDF.",
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}
