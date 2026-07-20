import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer';

const distDir = path.resolve('dist');
const port = 4173;
const spaShellHtml = await fs.readFile(path.join(distDir, 'index.html'));
const routes = [
  '/',
  '/templates',
  '/builder',
  '/cover-letter',
  '/pricing',
  '/examples',
  '/job-finder',
  '/blog',
  '/contact',
  '/about',
  '/privacy',
  '/terms',
  '/login',
];

const getContentType = (filePath) => {
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.txt')) return 'text/plain; charset=utf-8';
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
};

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const requestedPath = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.join(distDir, requestedPath);

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      stat = null;
    }

    if (stat?.isFile()) {
      const data = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': getContentType(filePath) });
      res.end(data);
      return;
    }

    // SPA fallback: always use the original Vite shell, not a route that was
    // already prerendered earlier in this script.
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(spaShellHtml);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
});

await new Promise((resolve) => server.listen(port, resolve));

let browser;
try {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
} catch (error) {
  console.warn('[prerender] Puppeteer failed to launch. Skipping prerendering.', error.message);
  await new Promise((resolve) => server.close(resolve));
  process.exit(0);
}

for (const route of routes) {
  const page = await browser.newPage();
  const targetUrl = `http://127.0.0.1:${port}${route}`;
  await page.goto(targetUrl, { waitUntil: 'networkidle0' });
  await new Promise((resolve) => setTimeout(resolve, 120));
  let html = await page.content();

  // Deduplicate title tags: keep the first title tag (which has the page-specific title) and remove subsequent ones
  const titleMatches = html.match(/<title[^>]*>([\s\S]*?)<\/title>/gi);
  if (titleMatches && titleMatches.length > 1) {
    const keepTitle = titleMatches[0];
    html = html.replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, '');
    html = html.replace('</head>', `${keepTitle}\n</head>`);
  }

  // Deduplicate meta description tags: keep the last one (injected by React Helmet) and remove others
  const descMatches = html.match(/<meta[^>]*name="description"[^>]*>/gi);
  if (descMatches && descMatches.length > 1) {
    const keepDesc = descMatches[descMatches.length - 1];
    html = html.replace(/<meta[^>]*name="description"[^>]*>/gi, '');
    html = html.replace('</head>', `${keepDesc}\n</head>`);
  }

  // Deduplicate canonical link tags: keep the last one (injected by React Helmet) and remove others
  const canonicalMatches = html.match(/<link[^>]*rel="canonical"[^>]*>/gi);
  if (canonicalMatches && canonicalMatches.length > 1) {
    const keepCanonical = canonicalMatches[canonicalMatches.length - 1];
    html = html.replace(/<link[^>]*rel="canonical"[^>]*>/gi, '');
    html = html.replace('</head>', `${keepCanonical}\n</head>`);
  }

  // Deduplicate og:title tags
  const ogTitleMatches = html.match(/<meta[^>]*property="og:title"[^>]*>/gi);
  if (ogTitleMatches && ogTitleMatches.length > 1) {
    const keepOgTitle = ogTitleMatches[ogTitleMatches.length - 1];
    html = html.replace(/<meta[^>]*property="og:title"[^>]*>/gi, '');
    html = html.replace('</head>', `${keepOgTitle}\n</head>`);
  }

  // Deduplicate og:description tags
  const ogDescMatches = html.match(/<meta[^>]*property="og:description"[^>]*>/gi);
  if (ogDescMatches && ogDescMatches.length > 1) {
    const keepOgDesc = ogDescMatches[ogDescMatches.length - 1];
    html = html.replace(/<meta[^>]*property="og:description"[^>]*>/gi, '');
    html = html.replace('</head>', `${keepOgDesc}\n</head>`);
  }

  // Deduplicate og:image tags
  const ogImageMatches = html.match(/<meta[^>]*property="og:image"[^>]*>/gi);
  if (ogImageMatches && ogImageMatches.length > 1) {
    const keepOgImage = ogImageMatches[ogImageMatches.length - 1];
    html = html.replace(/<meta[^>]*property="og:image"[^>]*>/gi, '');
    html = html.replace('</head>', `${keepOgImage}\n</head>`);
  }

  // Deduplicate og:url tags
  const ogUrlMatches = html.match(/<meta[^>]*property="og:url"[^>]*>/gi);
  if (ogUrlMatches && ogUrlMatches.length > 1) {
    const keepOgUrl = ogUrlMatches[ogUrlMatches.length - 1];
    html = html.replace(/<meta[^>]*property="og:url"[^>]*>/gi, '');
    html = html.replace('</head>', `${keepOgUrl}\n</head>`);
  }

  const outputPath =
    route === '/'
      ? path.join(distDir, 'index.html')
      : path.join(distDir, route.replace(/^\//, ''), 'index.html');

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `<!doctype html>\n${html}`, 'utf-8');
  await page.close();
}

await browser.close();
await new Promise((resolve) => server.close(resolve));

console.info(`[prerender] Completed ${routes.length} routes.`);
