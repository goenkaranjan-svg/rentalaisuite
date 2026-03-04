type SessionMeta = {
  sid: string;
  userId: string;
  userAgent: string;
  ip: string;
  createdAt: number;
  lastSeenAt: number;
};

const bySession = new Map<string, SessionMeta>();

export function trackSession(meta: SessionMeta) {
  bySession.set(meta.sid, meta);
}

export function touchSession(sid: string) {
  const existing = bySession.get(sid);
  if (!existing) return;
  existing.lastSeenAt = Date.now();
}

export function removeSession(sid: string) {
  bySession.delete(sid);
}

export function sessionsForUser(userId: string): SessionMeta[] {
  return Array.from(bySession.values())
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}
