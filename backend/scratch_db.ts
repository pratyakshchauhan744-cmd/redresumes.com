import { prisma } from "./src/db/prisma.js";

async function main() {
  const session = await prisma.interviewSession.findUnique({
    where: { id: "cmpxm61hn0005mmijduu60pn1" },
    include: { questions: { include: { answer: true } } }
  });
  if (!session) {
    console.log("Session not found");
    return;
  }
  const answered = session.questions.filter(q => q.answer).length;
  console.log(`Session: ${session.id}, status: ${session.status}, questions count: ${session.questions.length}, answered: ${answered}`);
  session.questions.forEach((q, idx) => {
    console.log(`  Q${idx+1}: "${q.questionText}", order: ${q.orderIndex}, hasAnswer: ${!!q.answer}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
