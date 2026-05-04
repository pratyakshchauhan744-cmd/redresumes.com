import { parseResumeWithGemini } from './src/modules/ai/service.ts';

async function test() {
  try {
    const res = await parseResumeWithGemini("Test resume text: John Doe, Software Engineer");
    console.log(res);
  } catch (err) {
    console.error(err);
  }
}
test();
