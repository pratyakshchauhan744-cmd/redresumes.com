import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

async function run() {
  try {
    const parser = new pdf.PDFParse();
    console.log("methods:", Object.keys(parser), Object.getPrototypeOf(parser));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
run();
