import { parseResumeWithGemini } from './backend/src/modules/ai/service.js';

async function main() {
  const result = await parseResumeWithGemini("This is a random text file about how to cook pasta. Boil water, add salt, then put pasta. Cook for 10 minutes.");
  console.log(result);
}

main().catch(console.error);
