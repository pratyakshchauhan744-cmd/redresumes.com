import fs from 'fs';
import { parseResumeWithGemini } from './dist/modules/ai/service.js';

async function test() {
  try {
    const res = await parseResumeWithGemini("Test resume text: John Doe, Software Engineer");
    console.log(res);
  } catch (err) {
    console.error(err);
  }
}
test();
