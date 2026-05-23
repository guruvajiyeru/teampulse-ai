import fs from "fs";
import { DB_DIR, DB_FILE } from "../config/config.js";

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: "Admin" | "Manager" | "Member";
  teams: string[];
  streak: number;
  lastSubmissionDate: string | null;
  badges: string[];
  avatar: string;
  timezone?: string;
  notificationSettings: {
    emailDigest: boolean;
    slackWebhookAlerts: boolean;
    dailyReminders: boolean;
  };
}

export interface Team {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  settings: {
    questions: string[];
    standupTime: string;
    timezone: string;
    deadline: string;
    theme: string;
    emoji: string;
    weekdays: string[];
    remindersEnabled?: boolean;
    slackChannel?: string;
    emailMailingList?: string;
    webhookUrl?: string;
    webhookToken?: string;
  };
  vacationUsers: string[];
}

export interface Standup {
  id: string;
  userId: string;
  userName: string;
  teamId: string;
  date: string;
  timestamp: string;
  yesterday: string;
  today: string;
  blockers: string;
  mood: string;
  isDraft: boolean;
  isBlocked: boolean;
  stressLevel: number;
  aiSummary?: string;
  aiBlockers?: string[];
  aiActionItems?: string[];
  aiMoodScore?: number;
  comments?: Array<{
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    text: string;
    timestamp: string;
  }>;
}

export interface TeamInsight {
  id: string;
  teamId: string;
  date: string;
  healthScore: number;
  summary: string;
  actionItems: string[];
  blockerFrequency: Record<string, number>;
  moodTrend: string;
}

const defaultData = { users: [] as User[], teams: [] as Team[], standups: [] as Standup[], insights: [] as TeamInsight[] };

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), "utf8");
      return { ...defaultData };
    }
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { ...defaultData };
  }
}

function writeDb(data: typeof defaultData) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write database file:", e);
  }
}

export const db = {
  getUsers: (): User[] => readDb().users,
  saveUsers: (users: User[]) => { const d = readDb(); d.users = users; writeDb(d); },
  getTeams: (): Team[] => readDb().teams,
  saveTeams: (teams: Team[]) => { const d = readDb(); d.teams = teams; writeDb(d); },
  getStandups: (): Standup[] => readDb().standups,
  saveStandups: (standups: Standup[]) => { const d = readDb(); d.standups = standups; writeDb(d); },
  getInsights: (): TeamInsight[] => readDb().insights,
  saveInsights: (insights: TeamInsight[]) => { const d = readDb(); d.insights = insights; writeDb(d); }
};
