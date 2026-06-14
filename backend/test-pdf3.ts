import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

async function run() {
  try {
    const fn = pdf.PDFParse || pdf.default || pdf;
    console.log("fn is function?", typeof fn === "function");
    const buffer = fs.readFileSync("/Users/mac/Desktop/redresumes.com/package.json");
    await fn(buffer);
    console.log("Success");
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
run();
