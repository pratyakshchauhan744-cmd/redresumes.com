export function exportFilename(disposition: string | null, fallback: string): string {
  let candidate: string | undefined;
  const extended = disposition?.match(/(?:^|;)\s*filename\*\s*=\s*(?:"([^"]*)"|([^;]*))/i);
  const encoded = extended?.[1] ?? extended?.[2];
  if (encoded) {
    const utf8 = encoded.trim().match(/^UTF-8'[^']*'(.*)$/i);
    if (utf8) { try { candidate = decodeURIComponent(utf8[1]); } catch { /* use ordinary filename */ } }
  }
  if (!candidate) {
    const ordinary = disposition?.match(/(?:^|;)\s*filename\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^;]*))/i);
    candidate = ordinary?.[1]?.replace(/\\(["\\])/g, "$1") ?? ordinary?.[2]?.trim();
  }
  const filename = candidate?.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!filename || filename === "." || filename === ".." || filename.length > 200) return fallback;
  const extension = fallback.split(".").pop();
  // Never make an executable download out of an untrusted filename header.
  return filename.toLowerCase().endsWith(`.${extension}`) ? filename : fallback;
}

/** Auth/error handling happens before this function. Never parse a file as JSON. */
export async function downloadExportResponse(response: Response, format: "csv" | "xlsx"): Promise<void> {
  const mime = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  const allowed = format === "xlsx"
    ? ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]
    : ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream"];
  if (!mime || !allowed.includes(mime)) throw new Error("Invalid export response. No file was downloaded.");
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("The export response was empty. No file was downloaded.");
  if (format === "xlsx") {
    const prefix = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (prefix[0] !== 0x50 || prefix[1] !== 0x4b || prefix[2] !== 0x03 || prefix[3] !== 0x04) {
      throw new Error("Invalid Excel export response. No file was downloaded.");
    }
  } else {
    const prefix = (await blob.slice(0, 512).text()).trimStart();
    if (/^<(?:!doctype|html|head|body)\b/i.test(prefix) || /^(?:\{|\[)/.test(prefix)) throw new Error("Invalid export response. No file was downloaded.");
  }
  const fallback = `student-reports-${new Date().toISOString().split("T")[0]}.${format}`;
  const anchor = document.createElement("a");
  const url = window.URL.createObjectURL(blob);
  try {
    anchor.href = url;
    anchor.download = exportFilename(response.headers.get("Content-Disposition"), fallback);
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    try { anchor.remove(); } finally { window.URL.revokeObjectURL(url); }
  }
}
