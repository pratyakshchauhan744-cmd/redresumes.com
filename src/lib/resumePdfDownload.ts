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
    "/api/resume/pdf",
    ...(API_BASE_URL ? [`${API_BASE_URL}/api/resume/pdf`] : []),
  ].filter((url, index, urls) => urls.indexOf(url) === index);

  let response: Response | null = null;
  let lastNetworkError: unknown;
  for (const endpointUrl of endpointUrls) {
    try {
      response = await fetch(endpointUrl, {
        method: "POST",
        credentials: "include",
        headers,
        body: requestBody,
      });
      if (response.ok || response.status !== 404) {
        break;
      }
    } catch (error) {
      lastNetworkError = error;
      response = null;
    }
  }

  if (!response) {
    throw new Error(
      lastNetworkError instanceof Error
        ? `Unable to reach PDF service: ${lastNetworkError.message}`
        : "Unable to reach PDF service. Please try again."
    );
  }

  if (!response.ok) {
    let message = "Unable to generate PDF. Please try again.";
    try {
      const payload = await response.json() as { message?: string; error?: string };
      message = payload.message || payload.error || message;
    } catch {
      // Keep the default message for non-JSON failures.
    }
    throw new Error(getUserSafePdfErrorMessage(message));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
