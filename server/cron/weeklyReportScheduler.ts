import cron from "node-cron";
import { db, TeamInsight } from "../models/db.js";
import { generateTeamInsights } from "../services/ai/gemini.js";
import { getTeamManagerEmail, generatePDFReportBuffer, sendWeeklyPDFEmail } from "../services/mail/email.js";
import crypto from "crypto";

/**
 * Compiles a weekly report for a specific team, generates its PDF,
 * and emails it to the team's manager.
 */
export async function compileWeeklyReportForTeam(teamId: string) {
  try {
    const teams = db.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      console.error(`[Weekly Report Cron] Team with ID ${teamId} not found.`);
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Filter standup entries from the last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const weeklyStandups = db.getStandups().filter(s => {
      if (s.teamId !== teamId || s.isDraft) return false;
      const standupDate = new Date(s.date);
      return standupDate >= oneWeekAgo;
    });

    console.log(`[Weekly Report Cron] Found ${weeklyStandups.length} standups over the last 7 days for team ${team.name}`);

    // Compile Gemini/Offline AI Insights
    const insightPayload = await generateTeamInsights(weeklyStandups, team.name);

    const newInsight: TeamInsight = {
      id: crypto.randomUUID(),
      teamId,
      date: todayStr,
      ...insightPayload
    };

    // Save Insight
    const insights = db.getInsights();
    const existingIndex = insights.findIndex(ins => ins.teamId === teamId && ins.date === todayStr);
    if (existingIndex !== -1) {
      insights[existingIndex] = newInsight;
    } else {
      insights.push(newInsight);
    }
    db.saveInsights(insights);
    console.log(`[Weekly Report Cron] Saved TeamInsight entry: ${newInsight.id} for date: ${todayStr}`);

    // Email manager
    const managerEmail = getTeamManagerEmail(teamId, team.ownerId);
    const pdfBuffer = generatePDFReportBuffer(team.name, weeklyStandups, newInsight);

    const mailResult = await sendWeeklyPDFEmail(managerEmail, team.name, pdfBuffer, newInsight);
    console.log(`[Weekly Report Cron] Report email dispatch finished. Mode: ${mailResult.mode}. Recipient: ${mailResult.emailList}`);
  } catch (error) {
    console.error(`[Weekly Report Cron] Failed to compile weekly report for team ${teamId}:`, error);
  }
}

/**
 * Initializes and schedules the automated Cron Jobs.
 */
export function initializeWeeklyReportCron() {
  console.log("⏱️ Initializing TeamPulseAI Weekly Scheduler Cron Daemon...");

  // Schedule a weekly task: Runs every Friday at 5:00 PM (17:00)
  // Cron format: minute hour day-of-month month day-of-week
  const cronExpression = "0 17 * * 5";

  // Check if expression is valid and schedule
  if (cron.validate(cronExpression)) {
    cron.schedule(cronExpression, async () => {
      console.log("🔔 [Scheduler Daemon] Triggering scheduled weekly report compiles across active workspaces...");
      const teams = db.getTeams();
      for (const team of teams) {
        console.log(`[Weekly Report Cron] Launching auto-compile task for Team: ${team.name}...`);
        await compileWeeklyReportForTeam(team.id);
      }
      console.log("🔔 [Scheduler Daemon] Automated weekly report tasks completed.");
    });
    console.log(`📅 Weekly Report Cron Job scheduled to fire automatically on pattern: "${cronExpression}" (Every Friday at 17:00)`);
  } else {
    console.error(`❌ Invalid cron expression pattern: "${cronExpression}"`);
  }
}
