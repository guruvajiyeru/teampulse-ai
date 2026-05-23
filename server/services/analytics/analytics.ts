import { User, Standup } from "../../models/db.js";

interface AnalyticsResult {
  totalMembers: number;
  submittedTodayCount: number;
  participationRate: number;
  averageMoodScore: number;
  totalBlockersCurrent: number;
  leaderboard: Array<{ id: string; name: string; streak: number; badges: string[] }>;
  last7DaysSubmissionsCount: number;
}

export function calculateTeamAnalytics(
  teamMembers: User[],
  teamStandups: Standup[],
  todayStr: string
): AnalyticsResult {
  const totalMembers = teamMembers.length;

  // Participation rate today
  const submittedTodayCount = teamStandups.filter(s => s.date === todayStr).length;
  const participationRate = totalMembers > 0 ? Math.round((submittedTodayCount / totalMembers) * 100) : 0;

  // Streaks leaderboards
  const leaderboard = teamMembers
    .map(m => ({ id: m.id, name: m.name, streak: m.streak, badges: m.badges }))
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 10);

  // Mood tracking metrics (avg mood score over the last 30 submissions)
  const moodScores = teamStandups
    .filter(s => typeof s.aiMoodScore === "number")
    .slice(0, 30) // sample last 30
    .map(s => s.aiMoodScore as number);
  
  const averageMoodScore = moodScores.length > 0 
    ? Math.round(moodScores.reduce((a, b) => a + b, 0) / moodScores.length) 
    : 80;

  // Blocker stats
  const blockerReports = teamStandups.filter(
    s => s.blockers && s.blockers.toLowerCase() !== "none" && s.blockers.trim() !== ""
  );

  return {
    totalMembers,
    submittedTodayCount,
    participationRate,
    averageMoodScore,
    totalBlockersCurrent: blockerReports.length,
    leaderboard,
    last7DaysSubmissionsCount: teamStandups.length
  };
}
