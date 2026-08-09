export type UserProgress = {
  userId: string;
  level: number;
  rankId: string;
  onTrackDays: number;
  currentStreak: number;
  bestStreak: number;
  disciplineScore: number;
  leaderboardVisible: boolean;
  updatedAt: string;
  createdAt: string;
};

export function emptyUserProgress(userId: string): UserProgress {
  const now = new Date().toISOString();
  return {
    userId,
    level: 1,
    rankId: "start",
    onTrackDays: 0,
    currentStreak: 0,
    bestStreak: 0,
    disciplineScore: 0,
    leaderboardVisible: false,
    updatedAt: now,
    createdAt: now,
  };
}
