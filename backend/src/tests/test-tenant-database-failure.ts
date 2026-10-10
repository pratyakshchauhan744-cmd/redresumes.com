import assert from 'node:assert/strict';
import express from 'express';
import { prisma } from '../db/prisma.js';
import { requireTenant } from '../middleware/tenant.js';
import { errorHandler } from '../middleware/error-handler.js';

const original = prisma.college.findUnique;
const outage = Object.assign(new Error("Can't reach database server"), { code: 'P1001' });
prisma.college.findUnique = (async () => { throw outage; }) as unknown as typeof original;
const app = express();
app.get('/tenant', (req, _res, next) => {
  req.user = { id: 'test-faculty', email: 'test@example.com', role: 'college_faculty', collegeId: 'uncached-outage-test' };
  next();
}, requireTenant, (_req, res) => res.json({ unexpected: true }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use(errorHandler);
const server = app.listen(0, '127.0.0.1');
try {
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  for (let i = 0; i < 2; i++) {
    const response = await fetch(`${base}/tenant`);
    assert.equal(response.status, 503);
    assert.equal((await fetch(`${base}/health`)).status, 200);
  }
  console.log('PASS repeated tenant database failures return 503 and leave the API alive');
} finally {
  prisma.college.findUnique = original;
  await new Promise<void>(resolve => server.close(() => resolve()));
  await prisma.$disconnect();
}
