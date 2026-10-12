import type { CreditLedgerActor } from "../types/creditLedger";

export function getCreditLedgerActorLabel(actor: CreditLedgerActor): string {
  return actor.name;
}
