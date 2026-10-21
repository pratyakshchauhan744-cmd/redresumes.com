/** Shared Chromium launcher for resume and interview PDF rendering. */
export async function launchPdfBrowser() {
    const isVercelRuntime = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

    if (isVercelRuntime) {
      const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
        // @ts-ignore
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

      return await puppeteer.launch({
        args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
        defaultViewport: viewport,
        executablePath: await chromium.executablePath(),
        headless: "shell",
      });
    } else {
      const { default: puppeteer } = await import("puppeteer");

      return await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--font-render-hinting=none",
        ],
      });
    }

}
