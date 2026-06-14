import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

async function run() {
  try {
    const buffer = fs.readFileSync("/Users/mac/Desktop/redresumes.com/package.json");
    console.log("pdfParse type:", typeof pdfParse);
    // Let's pass a dummy buffer, it should throw a specific error, not a TypeError
    await pdfParse(buffer);
    console.log("Success");
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
run();
