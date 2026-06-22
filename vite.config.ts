import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage } from 'node:http';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

const readJsonBody = async (req: IncomingMessage, limitBytes: number) => {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limitBytes) {
      throw new Error('Request body is too large.');
    }
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as { html?: unknown; fileName?: unknown };
};

const sanitizePdfFileName = (value: string) => {
  const normalized = value.replace(/[/\\?%*:|"<>]/g, '-').trim();
  return normalized.toLowerCase().endsWith('.pdf') ? normalized : `${normalized || 'resume'}.pdf`;
};

const getPdfScale = async (page: import('puppeteer').Page) => {
  return page.evaluate(() => {
    const content =
      document.querySelector<HTMLElement>('.resume') ??
      document.querySelector<HTMLElement>('.resume-pdf-fit') ??
      document.body;
    const contentHeight = Math.max(content.scrollHeight, content.getBoundingClientRect().height);
    const printableA4HeightPx = (297 - 24) * (96 / 25.4) * 0.98;

    if (!contentHeight || contentHeight <= printableA4HeightPx) {
      return 1;
    }

    return Math.max(0.72, Math.min(1, printableA4HeightPx / contentHeight));
  });
};

const localResumePdfPlugin = () => ({
  name: 'local-resume-pdf',
  configureServer(server: any) {
    server.middlewares.use('/api/resume/pdf', async (req: IncomingMessage, res: any) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ message: 'Method not allowed' }));
        return;
      }

      let browser: import('puppeteer').Browser | undefined;
      try {
        const body = await readJsonBody(req, 12 * 1024 * 1024);
        if (typeof body.html !== 'string' || body.html.length === 0) {
          res.statusCode = 400;
          res.end(JSON.stringify({ message: 'Resume HTML is required.' }));
          return;
        }

        const puppeteer = await import('puppeteer');
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
        });

        const page = await browser.newPage();
        await page.setContent(body.html, { waitUntil: ['load', 'networkidle0'], timeout: 30_000 });
        await page.emulateMediaType('print');
        const pdfScale = await getPdfScale(page);
        const pdf = await page.pdf({
          format: 'A4',
          scale: pdfScale,
          printBackground: true,
          displayHeaderFooter: false,
          preferCSSPageSize: true,
          margin: {
            top: '12mm',
            right: '12mm',
            bottom: '12mm',
            left: '12mm',
          },
        });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizePdfFileName(String(body.fileName || 'resume.pdf'))}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.end(Buffer.from(pdf));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Unable to generate PDF.' }));
      } finally {
        if (browser) {
          await browser.close().catch(() => undefined);
        }
      }
    });
  },
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      localResumePdfPlugin(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
