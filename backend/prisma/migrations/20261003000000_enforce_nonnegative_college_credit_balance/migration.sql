-- The institutional balance is a billing invariant and must remain non-negative
-- even if a future application code path omits its balance validation.
ALTER TABLE "CollegeCreditAccount"
ADD CONSTRAINT "CollegeCreditAccount_balance_nonnegative"
CHECK ("balance" >= 0);
