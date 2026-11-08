export const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

export interface LockoutStatus {
  isLocked: boolean;
  remainingMs: number;
  remainingMins: number;
  remainingSecs: number;
  formattedTime: string;
}

export function evaluateLockout(submittedAt: number | null | undefined, isAdmin: boolean = false): LockoutStatus {
  if (!submittedAt) {
    return {
      isLocked: false,
      remainingMs: LOCKOUT_DURATION_MS,
      remainingMins: 30,
      remainingSecs: 0,
      formattedTime: "30m 00s"
    };
  }

  const elapsedMs = Date.now() - submittedAt;
  const isLocked = elapsedMs > LOCKOUT_DURATION_MS && !isAdmin;
  const remainingMs = Math.max(0, LOCKOUT_DURATION_MS - elapsedMs);
  const remainingMins = Math.floor(remainingMs / 60000);
  const remainingSecs = Math.floor((remainingMs % 60000) / 1000);
  const formattedTime = `${remainingMins}m ${remainingSecs < 10 ? '0' : ''}${remainingSecs}s`;

  return {
    isLocked,
    remainingMs,
    remainingMins,
    remainingSecs,
    formattedTime
  };
}

