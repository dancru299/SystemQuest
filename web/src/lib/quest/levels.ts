export const LEVELS = [
  { level: 1, title: "Nguoi Trieu Hoi", xp: 0 },
  { level: 2, title: "Phieu Luu Gia", xp: 500 },
  { level: 3, title: "Anh Hung Moi Noi", xp: 1500 },
  { level: 4, title: "Chien Binh He Thong", xp: 3500 },
  { level: 5, title: "Huyen Thoai Di Gioi", xp: 7000 },
] as const;

export function getLevelForXp(xp: number) {
  return [...LEVELS].reverse().find((level) => xp >= level.xp) ?? LEVELS[0];
}

export function getNextLevel(xp: number) {
  return LEVELS.find((level) => level.xp > xp) ?? null;
}

export function getLevelProgress(xp: number) {
  const current = getLevelForXp(xp);
  const next = getNextLevel(xp);

  if (!next) {
    return { current, next, percent: 100, remaining: 0 };
  }

  const span = next.xp - current.xp;
  const percent = Math.min(100, Math.max(0, ((xp - current.xp) / span) * 100));

  return { current, next, percent, remaining: next.xp - xp };
}

