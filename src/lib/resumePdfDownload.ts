import { getStoredAccessToken } from "./auth";
import { resolveApiBaseUrl } from "./backendApi";

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const isBrowser = typeof window !== "undefined";
const API_BASE_URL = resolveApiBaseUrl(configuredApiBaseUrl, isBrowser ? window.location.hostname : undefined);

const getUserSafePdfErrorMessage = (message: string): string => {
  const lower = message.toLowerCase();
  if (
    lower.includes("could not find chrome") ||
    lower.includes("libnspr4.so") ||
    lower.includes("puppeteer") ||
    lower.includes("failed to launch the browser process")
  ) {
    return "PDF download is temporarily unavailable. Please try again in a few minutes.";
  }

  return message;
};

export async function downloadResumePdfClientSide(html: string, fileName: string): Promise<void> {
  if (typeof window === "undefined") return;

  const sanitizedFileName = fileName.trim().toLowerCase().endsWith(".pdf")
    ? fileName.trim()
    : `${fileName.trim() || "resume"}.pdf`;

  // Create an isolated hidden iframe to render the resume's exact HTML, CSS and fonts
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "794px"; // Standard A4 width at 96 DPI
  iframe.style.height = "1123px"; // Standard A4 height at 96 DPI
  iframe.style.border = "none";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-9999";
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error("Could not initialize print rendering frame.");
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Wait for fonts to finish loading
    try {
      if (iframeDoc.fonts?.ready) {
        await iframeDoc.fonts.ready;
      }
    } catch {
      // Continue if font ready check is unavailable
    }

    // Small delay to ensure CSS calculations and rendering stabilize
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Wait for images inside iframe to finish loading
    const images = Array.from(iframeDoc.images);
    if (images.length > 0) {
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((res) => {
              if (img.complete) {
                res();
              } else {
                img.onload = () => res();
                img.onerror = () => res();
              }
            })
        )
      );
    }

    // Client-side PDF generation via html2pdf.js
    const html2pdfModule = await import("html2pdf.js");
    const html2pdf = (html2pdfModule as any).default || html2pdfModule;

    const targetElement =
      iframeDoc.querySelector<HTMLElement>(".resume") ||
      iframeDoc.querySelector<HTMLElement>(".resume-pdf-dom-shell") ||
      iframeDoc.body;

    const opt = {
      margin: [0, 0, 0, 0] as [number, number, number, number],
      filename: sanitizedFileName,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 794,
        letterRendering: true,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      },
    };

    await html2pdf().set(opt).from(targetElement).save();
  } catch (clientPdfError) {
    console.warn("html2pdf client rendering fallback failed, using browser print dialog:", clientPdfError);
    if (iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  } finally {
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);
  }
}

export async function downloadResumePdfFromHtml(html: string, fileName: string): Promise<void> {
  const token = getStoredAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const requestBody = JSON.stringify({ html, fileName });
  const endpointUrls = [
    ...(API_BASE_URL ? [`${API_BASE_URL}/api/resume/pdf`] : []),
    "/api/resume/pdf",
  ].filter((url, index, urls) => urls.indexOf(url) === index);

  let response: Response | null = null;
  for (const endpointUrl of endpointUrls) {
    try {
      const res = await fetch(endpointUrl, {
        method: "POST",
        credentials: "include",
        headers,
        body: requestBody,
      });
      const contentType = res.headers.get("content-type") || "";
      // Only accept response if it is 200 OK AND actually returned binary PDF
      if (res.ok && contentType.toLowerCase().includes("application/pdf")) {
        response = res;
        break;
      }
    } catch {
      response = null;
    }
  }

  // If server responded successfully with a genuine PDF blob, download it
  if (response && response.ok) {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  // If server endpoint was unavailable, returned HTML (SPA fallback), or errored:
  // Render exact PDF client-side using html2pdf with inlined styles and fonts.
  await downloadResumePdfClientSide(html, fileName);
}

function extractDocumentStyles(): string {
  if (typeof document === 'undefined') return '';
  const cssChunks: string[] = [];

  // Extract rules from document.styleSheets (contains compiled Tailwind CSS classes)
  try {
    const sheets = Array.from(document.styleSheets);
    for (const sheet of sheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          const ruleTexts: string[] = [];
          for (let i = 0; i < rules.length; i++) {
            ruleTexts.push(rules[i].cssText);
          }
          if (ruleTexts.length > 0) {
            cssChunks.push(ruleTexts.join('\n'));
          }
        }
      } catch {
        // Cross-origin stylesheet access might throw a SecurityError in some environments
      }
    }
  } catch {
    // Ignore error
  }

  // Extract from inline style tags
  try {
    const styleTags = Array.from(document.querySelectorAll('style'));
    for (const tag of styleTags) {
      if (tag.textContent && tag.textContent.trim()) {
        cssChunks.push(tag.textContent);
      }
    }
  } catch {
    // Ignore error
  }

  return cssChunks.join('\n');
}

function extractStylesheetLinks(): string {
  if (typeof document === 'undefined') return '';
  const linkTags = Array.from(
    document.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"], link[rel="preload"][as="style"]'
    )
  );

  return linkTags
    .map((link) => {
      const href = link.href || link.getAttribute('href');
      if (!href) return '';
      return `<link rel="stylesheet" href="${href}" />`;
    })
    .filter(Boolean)
    .join('\n');
}

export function buildResumePdfHtmlFromElement(element: HTMLElement, fileName: string): string {
  const inlinedCss = extractDocumentStyles();
  const stylesheetLinks = extractStylesheetLinks();
  const baseHref = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <base href="${baseHref}" />
    <title>${fileName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    ${stylesheetLinks}
    ${inlinedCss ? `<style>\n${inlinedCss}\n</style>` : ''}
    <style>
      @page { size: A4; margin: 12mm; }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        display: flex;
        justify-content: center;
      }
      .resume-pdf-dom-shell {
        width: 100%;
        max-width: 186mm;
        background: #ffffff;
      }
      .resume-pdf-dom-shell .template-preview-scale-shell,
      .resume-pdf-dom-shell .template-preview-scale-stage,
      .resume-pdf-dom-shell .template-preview-scale-page {
        height: auto !important;
        margin: 0 !important;
        max-width: none !important;
        transform: none !important;
        width: 100% !important;
      }
      .resume-pdf-dom-shell .template-visual-preview {
        width: 100% !important;
        border: none !important;
        box-shadow: none !important;
      }
      .resume-pdf-dom-shell section,
      .resume-pdf-dom-shell article {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    </style>
  </head>
  <body>
    <main class="resume-pdf-dom-shell">${element.outerHTML}</main>
  </body>
</html>`;
}

