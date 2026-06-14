import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer';

const distDir = path.resolve('dist');
const port = 4173;
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

    // SPA fallback
    const indexHtml = await fs.readFile(path.join(distDir, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(indexHtml);
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
  const html = await page.content();

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
