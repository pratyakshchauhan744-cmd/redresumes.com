export interface CreditLedgerActor {
  name: string;
  email: string;
  role: string;
}

export interface CreditLedgerRecipientStudent {
  enrollmentNumber: string;
  name: string;
  email: string;
  program: string;
  course: string;
  section: string;
  batch: string;
}

export interface CreditLedgerTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
  batchFilter: unknown;
  performedBy: CreditLedgerActor;
  recipientStudent: CreditLedgerRecipientStudent | null;
}

export interface CreditLedgerResponse {
  transactions: CreditLedgerTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  collegeBalance: number;
}
