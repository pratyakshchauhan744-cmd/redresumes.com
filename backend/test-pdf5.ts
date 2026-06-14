import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

async function run() {
  console.log("pdf is function?", typeof pdf === "function");
}
run();
