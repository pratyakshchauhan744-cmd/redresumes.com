-- User identities are global and email comparisons are case-insensitive throughout
-- authentication. This functional index closes the check-then-create race while
-- also protecting legacy mixed-case addresses.
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_normalized_key"
ON "User" (LOWER(BTRIM("email")));
