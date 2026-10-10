-- Indexes for scoped Enterprise reads. Apply through the normal migration workflow.
CREATE INDEX "InterviewSession_userId_status_idx" ON "InterviewSession"("userId", "status");
CREATE INDEX "InterviewSession_collegeId_userId_idx" ON "InterviewSession"("collegeId", "userId");
CREATE INDEX "CollegeStudent_collegeId_batch_enrollmentNumber_idx" ON "CollegeStudent"("collegeId", "batch" DESC, "enrollmentNumber");
CREATE INDEX "Invitation_collegeId_role_email_createdAt_id_idx" ON "Invitation"("collegeId", "role", "email", "createdAt" DESC, "id" DESC);
CREATE INDEX "CollegeCreditTransaction_collegeId_createdAt_idx" ON "CollegeCreditTransaction"("collegeId", "createdAt" DESC);
CREATE INDEX "EnterpriseAuditLog_collegeId_createdAt_idx" ON "EnterpriseAuditLog"("collegeId", "createdAt" DESC);
CREATE INDEX "EnterpriseAuditLog_collegeId_action_createdAt_idx" ON "EnterpriseAuditLog"("collegeId", "action", "createdAt" DESC);
