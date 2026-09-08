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

  // Create an isolated iframe to render the resume's exact HTML and CSS
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "794px"; // Standard A4 width at 96 DPI (210mm)
  iframe.style.height = "1123px"; // Standard A4 height at 96 DPI (297mm)
  iframe.style.border = "none";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-1";
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error("Could not initialize print rendering frame.");
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Allow CSS, fonts and layout to calculate
    await new Promise((resolve) => setTimeout(resolve, 350));

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

    // Client-side PDF generation via html2pdf
    try {
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = (html2pdfModule as any).default || html2pdfModule;

      const targetElement = iframeDoc.querySelector<HTMLElement>(".resume") || iframeDoc.body;

      const opt = {
        margin: [6, 6, 6, 6] as [number, number, number, number],
        filename: sanitizedFileName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 794,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
      };

      await html2pdf().set(opt).from(targetElement).save();
      return;
    } catch (clientPdfError) {
      console.warn("html2pdf failed, falling back to browser print:", clientPdfError);
    }

    // Secondary fallback: browser print dialog
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
      response = await fetch(endpointUrl, {
        method: "POST",
        credentials: "include",
        headers,
        body: requestBody,
      });
      if (response.ok) {
        break;
      }
    } catch {
      response = null;
    }
  }

  // If server responded successfully with a PDF blob, download it
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

  // Server endpoint unavailable (e.g. 405 on static Vercel, offline backend) -> Client-side PDF fallback
  await downloadResumePdfClientSide(html, fileName);
}

export function buildResumePdfHtmlFromElement(element: HTMLElement, fileName: string): string {
  const styleMarkup = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");
  const baseHref = `${window.location.origin}/`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <base href="${baseHref}" />
    <title>${fileName}</title>
    ${styleMarkup}
    <style>
      @page { size: A4; margin: 12mm; }
      html, body {
        margin: 0;
        background: #ffffff;
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
