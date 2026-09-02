export function getAvailableCredit(balance: number, limit: number) {
  if (!Number.isFinite(balance) || !Number.isFinite(limit)) return 0;
  return Math.max(0, limit - balance);
}

export function canChargeCurrentAccount(balance: number, limit: number, amount: number) {
  if (![balance, limit, amount].every(Number.isFinite)) return false;
  if (amount <= 0 || limit <= 0 || balance < 0) return false;
  return balance + amount <= limit;
}
