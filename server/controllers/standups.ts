import { Response } from "express";
import crypto from "crypto";
import { db, Standup, TeamInsight, User } from "../models/db.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { analyzeStandup, generateTeamInsights, askSprintCoachAI } from "../services/ai/gemini.js";
import { formatAndSendEmailDigest, getTeamManagerEmail, generatePDFReportBuffer, sendWeeklyPDFEmail } from "../services/mail/email.js";
import { formatAndSendSlackBroadcast } from "../services/integrations/slack.js";
import { formatJiraLogItem } from "../services/integrations/jira.js";
import { calculateTeamAnalytics } from "../services/analytics/analytics.js";

export async function submitStandup(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId, yesterday, today, blockers, mood, isDraft, isBlocked, stressLevel } = req.body;
    if (!teamId || !mood) {
      res.status(400).json({ success: false, message: "Team ID and Mood are required parameters" });
      return;
    }

    const userId = req.user!.id;
    const userName = req.user!.name;
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const standups = db.getStandups();

    // Check if there is already a standup or draft for today
    const existingIndex = standups.findIndex(
      s => s.userId === userId && s.teamId === teamId && s.date === dateStr
    );

    let finalYesterday = yesterday || "";
    let finalToday = today || "";
    let finalBlockers = blockers || "";

    let standupItem: Standup;

    if (existingIndex !== -1) {
      standupItem = standups[existingIndex];
      // Update values
      standupItem.yesterday = finalYesterday;
      standupItem.today = finalToday;
      standupItem.blockers = finalBlockers;
      standupItem.mood = mood;
      standupItem.isDraft = !!isDraft;
      standupItem.isBlocked = typeof isBlocked === "boolean" ? isBlocked : !!finalBlockers.trim();
      standupItem.stressLevel = typeof stressLevel === "number" ? stressLevel : 3;
      standupItem.timestamp = new Date().toISOString();
    } else {
      standupItem = {
        id: crypto.randomUUID(),
        userId,
        userName,
        teamId,
        date: dateStr,
        timestamp: new Date().toISOString(),
        yesterday: finalYesterday,
        today: finalToday,
        blockers: finalBlockers,
        mood,
        isDraft: !!isDraft,
        isBlocked: typeof isBlocked === "boolean" ? isBlocked : !!finalBlockers.trim(),
        stressLevel: typeof stressLevel === "number" ? stressLevel : 3
      };
      standups.push(standupItem);
    }

    // Trigger AI analysis if it is committed (not a draft)
    if (!standupItem.isDraft) {
      const aiMetrics = await analyzeStandup(
        standupItem.yesterday,
        standupItem.today,
        standupItem.blockers,
        standupItem.mood
      );

      standupItem.aiSummary = aiMetrics.aiSummary;
      standupItem.aiBlockers = aiMetrics.aiBlockers;
      standupItem.aiActionItems = aiMetrics.aiActionItems;
      standupItem.aiMoodScore = aiMetrics.aiMoodScore;

      // Handle user streaks and lastSubmissions dates
      const users = db.getUsers();
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        const user = users[userIndex];
        const lastSub = user.lastSubmissionDate;

        if (lastSub !== dateStr) {
          if (lastSub === null) {
            user.streak = 1;
          } else {
            // Check if lastSub was yesterday
            const yesterdayDate = new Date();
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

            if (lastSub === yesterdayStr) {
              user.streak += 1;
            } else {
              user.streak = 1; // broken and restarted
            }
          }
          user.lastSubmissionDate = dateStr;
        }
        db.saveUsers(users);
      }
    }

    db.saveStandups(standups);

    res.status(200).json({
      success: true,
      message: standupItem.isDraft ? "Standup draft saved online" : "Daily standup submitted successfully!",
      data: {
        standup: standupItem
      }
    });
  } catch (error) {
    console.error("Submit standup controller error:", error);
    res.status(500).json({ success: false, message: "Standard compilation failed for standup submission" });
  }
}

export async function getDraft(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const userId = req.user!.id;
    const dateStr = new Date().toISOString().split("T")[0];

    const standups = db.getStandups();
    const draft = standups.find(
      s => s.userId === userId && s.teamId === teamId && s.date === dateStr && s.isDraft
    );

    res.status(200).json({
      success: true,
      data: {
        draft: draft || null
      }
    });
  } catch (error) {
    console.error("Get draft controller error:", error);
    res.status(500).json({ success: false, message: "Failed to find active standup draft" });
  }
}

export async function getStandups(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const { date, userId, search, hasBlockers } = req.query;

    let standups = db.getStandups().filter(s => s.teamId === teamId && !s.isDraft);

    // Apply Filters
    if (date) {
      standups = standups.filter(s => s.date === date);
    }
    if (userId) {
      standups = standups.filter(s => s.userId === userId);
    }
    if (hasBlockers === "true") {
      standups = standups.filter(
        s => s.blockers && s.blockers.toLowerCase() !== "none" && s.blockers.trim() !== ""
      );
    }
    if (search) {
      const term = (search as string).toLowerCase();
      standups = standups.filter(
        s =>
          s.yesterday.toLowerCase().includes(term) ||
          s.today.toLowerCase().includes(term) ||
          s.blockers.toLowerCase().includes(term) ||
          s.userName.toLowerCase().includes(term)
      );
    }

    // Sort by timestamp desc
    standups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const allUsers = db.getUsers();
    const standupsWithAvatars = standups.map(s => {
      const u = allUsers.find(user => user.id === s.userId);
      const comments = (s.comments || []).map(c => {
        const commenter = allUsers.find(user => user.id === c.userId);
        return {
          ...c,
          userAvatar: commenter?.avatar || c.userAvatar || "🦊",
          userName: commenter?.name || c.userName
        };
      });
      return {
        ...s,
        userAvatar: u?.avatar || "🦊",
        comments
      };
    });

    res.status(200).json({
      success: true,
      data: {
        standups: standupsWithAvatars
      }
    });
  } catch (error) {
    console.error("Get standups controller error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve standup list" });
  }
}

export async function generateTeamReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const { date } = req.query; // YYYY-MM-DD, defaults to today
    
    const dateStr = (date as string) || new Date().toISOString().split("T")[0];

    const teams = db.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      res.status(404).json({ success: false, message: "Team not found" });
      return;
    }

    const teamStandupsForDate = db.getStandups().filter(
      s => s.teamId === teamId && s.date === dateStr && !s.isDraft
    );

    // Call Gemini insights compiler
    const insightPayload = await generateTeamInsights(teamStandupsForDate, team.name);

    const newInsight: TeamInsight = {
      id: crypto.randomUUID(),
      teamId,
      date: dateStr,
      ...insightPayload
    };

    // Save Insight, replacing duplicate if exists
    const insights = db.getInsights();
    const existingIndex = insights.findIndex(ins => ins.teamId === teamId && ins.date === dateStr);
    if (existingIndex !== -1) {
      insights[existingIndex] = newInsight;
    } else {
      insights.push(newInsight);
    }
    db.saveInsights(insights);

    // Dynamic manager lookup
    const managerEmail = getTeamManagerEmail(teamId, team.ownerId);

    // Get all standups for this team for this specific report (date)
    const standupsForReport = db.getStandups().filter(s => s.teamId === teamId && s.date === dateStr && !s.isDraft);

    // Automatically trigger visual PDF generation & email handoff to Team Manager
    const mailResult = await sendWeeklyPDFEmail(managerEmail, team.name, generatePDFReportBuffer(team.name, standupsForReport, newInsight), newInsight);

    res.status(200).json({
      success: true,
      message: "AI team intelligence report triggered successfully and emailed to the Team Manager",
      data: {
        insight: newInsight,
        emailDelivery: {
          success: mailResult.success,
          recipient: mailResult.emailList,
          mode: mailResult.mode,
          trace: mailResult.logTrace,
          deliveredAt: mailResult.deliveredAt
        }
      }
    });
  } catch (error) {
    console.error("Generate team report error:", error);
    res.status(500).json({ success: false, message: "Failed to compile AI coach insights" });
  }
}

export async function getTeamInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const { date } = req.query;

    const insights = db.getInsights().filter(ins => ins.teamId === teamId);
    
    // If a specific date requested
    if (date) {
      const match = insights.find(ins => ins.date === date);
      res.status(200).json({
        success: true,
        data: {
          insight: match || null
        }
      });
      return;
    }

    // Otherwise return history of parsed insights, sorted desc
    insights.sort((a, b) => b.date.localeCompare(a.date));

    res.status(200).json({
      success: true,
      data: {
        insights
      }
    });
  } catch (error) {
    console.error("Get team insights error:", error);
    res.status(500).json({ success: false, message: "Failed to load team insights history" });
  }
}

export async function getTeamAnalyticsMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    
    const teams = db.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      res.status(404).json({ success: false, message: "Team not found" });
      return;
    }

    const allUsers = db.getUsers();
    const teamMembers = allUsers.filter(u => u.teams.includes(teamId));
    const teamStandups = db.getStandups().filter(s => s.teamId === teamId && !s.isDraft);
    const todayStr = new Date().toISOString().split("T")[0];

    const analytics = calculateTeamAnalytics(teamMembers, teamStandups, todayStr);

    res.status(200).json({
      success: true,
      data: {
        analytics
      }
    });
  } catch (error) {
    console.error("Get team analytics metrics error:", error);
    res.status(500).json({ success: false, message: "Failed to generate visual chart telemetry metrics" });
  }
}

export async function addComment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { standupId } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ success: false, message: "Comment message cannot be empty" });
      return;
    }

    const userId = req.user!.id;
    const userName = req.user!.name;
    const users = db.getUsers();
    const currentUser = users.find(u => u.id === userId);
    const userAvatar = currentUser?.avatar || "🦊";

    const standups = db.getStandups();
    const standupIndex = standups.findIndex(s => s.id === standupId);
    if (standupIndex === -1) {
      res.status(404).json({ success: false, message: "Standup report not found" });
      return;
    }

    const commentItem = {
      id: crypto.randomUUID(),
      userId,
      userName,
      userAvatar,
      text: text.trim(),
      timestamp: new Date().toISOString()
    };

    if (!standups[standupIndex].comments) {
      standups[standupIndex].comments = [];
    }

    standups[standupIndex].comments!.push(commentItem);
    db.saveStandups(standups);

    // Broadcast change via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(standups[standupIndex].teamId).emit("comment_created", {
        standupId,
        comment: commentItem
      });
    }

    res.status(200).json({
      success: true,
      message: "Comment appended and broadcasted successfully!",
      data: {
        comment: commentItem
      }
    });
  } catch (error) {
    console.error("Add comment controller error:", error);
    res.status(500).json({ success: false, message: "Failed to post comment to standup repo" });
  }
}

export async function askSprintCoach(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const { question, chatHistory } = req.body;

    if (!teamId || !question) {
      res.status(400).json({ success: false, message: "Team ID and Question are required parameters" });
      return;
    }

    const nameOfTeam = db.getTeams().find(t => t.id === teamId);
    if (!nameOfTeam) {
      res.status(404).json({ success: false, message: "Team not found" });
      return;
    }

    const allUsers = db.getUsers();
    const currentUser = allUsers.find(u => u.id === req.user!.id);
    if (!currentUser || !currentUser.teams.includes(teamId)) {
      res.status(403).json({ success: false, message: "Access denied. You are not a member of this team." });
      return;
    }

    const teamMembers = allUsers
      .filter(u => u.teams.includes(teamId))
      .map(u => ({ id: u.id, name: u.name, role: u.role, streak: u.streak }));

    const teamStandups = db.getStandups().filter(s => s.teamId === teamId && !s.isDraft);

    const answer = await askSprintCoachAI(teamStandups, nameOfTeam.name, teamMembers, question, chatHistory || []);

    res.status(200).json({
      success: true,
      data: {
        answer
      }
    });
  } catch (error) {
    console.error("Sprint Coach controller error:", error);
    res.status(500).json({ success: false, message: "Failed to generate AI sprint coach recommendations" });
  }
}

export async function broadcastEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const teams = db.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      res.status(404).json({ success: false, message: "Team workspace not found" });
      return;
    }
    
    const standups = db.getStandups().filter(s => s.teamId === teamId && s.date === new Date().toISOString().split("T")[0] && !s.isDraft);
    const insights = db.getInsights ? db.getInsights().filter(i => i.teamId === teamId) : [];
    const latestInsight = insights[0];

    // Delegate formatting and delivery logic to mail service
    const result = formatAndSendEmailDigest(team, standups, latestInsight);

    res.status(200).json({
      success: true,
      message: `Daily report digest successfully broadcasted to ${result.emailList}`,
      data: {
        recipientList: result.emailList,
        logs: result.logTrace,
        deliveredAt: result.deliveredAt
      }
    });
  } catch (error) {
    console.error("Email broadcast error:", error);
    res.status(500).json({ success: false, message: "SMTP service failed to deliver report compile" });
  }
}

export async function broadcastSlack(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const teams = db.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      res.status(404).json({ success: false, message: "Team workspace not found" });
      return;
    }
    
    const standups = db.getStandups().filter(s => s.teamId === teamId && s.date === new Date().toISOString().split("T")[0] && !s.isDraft);

    // Delegate formatting and webhook post logic to integrations service
    const result = formatAndSendSlackBroadcast(team, standups);

    res.status(200).json({
      success: true,
      message: `Finalized board feed update pinged successfully to Slack channel ${result.channel}`,
      data: {
        channel: result.channel,
        logs: result.logTrace,
        dispatchedAt: result.dispatchedAt
      }
    });
  } catch (error) {
    console.error("Slack broadcast error:", error);
    res.status(500).json({ success: false, message: "Webhook post failed to execute socket connection" });
  }
}

export async function jiraWebhookUpdate(req: any, res: Response): Promise<void> {
  try {
    const { email, teamId, issueKey, summary, token } = req.body;
    
    if (!email || !teamId || !issueKey) {
      res.status(400).json({ success: false, message: "Missing required parameters: email, teamId, and issueKey match are mandatory." });
      return;
    }

    const users = db.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      res.status(404).json({ success: false, message: "User not found with organizational email: " + email });
      return;
    }

    const teams = db.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      res.status(404).json({ success: false, message: "Team workspace targeting error." });
      return;
    }

    // Update or populate draft for yesterday field
    const standups = db.getStandups();
    const dateStr = new Date().toISOString().split("T")[0];
    const existingIndex = standups.findIndex(s => s.userId === user.id && s.teamId === teamId && s.date === dateStr);

    // Delegate formatting of issue logs to external integrations service
    const jiraLogItem = formatJiraLogItem(issueKey, summary);

    if (existingIndex !== -1) {
      const draft = standups[existingIndex];
      if (draft.isDraft) {
        draft.yesterday = draft.yesterday ? (draft.yesterday + "\n- " + jiraLogItem) : ("- " + jiraLogItem);
        draft.timestamp = new Date().toISOString();
      }
    } else {
      standups.push({
        id: crypto.randomUUID(),
        userId: user.id,
        userName: user.name,
        teamId: team.id,
        date: dateStr,
        timestamp: new Date().toISOString(),
        yesterday: "- " + jiraLogItem,
        today: "",
        blockers: "",
        mood: "good",
        isDraft: true,
        isBlocked: false,
        stressLevel: 3
      });
    }

    db.saveStandups(standups);

    res.status(200).json({
      success: true,
      message: `Jira Webhook received successfully. Populated yesterday's check-in draft for ${user.name}`,
      data: {
        ticket: issueKey,
        populatedText: jiraLogItem,
        user: user.name,
        team: team.name
      }
    });

  } catch (error) {
    console.error("Jira webhook controller error:", error);
    res.status(500).json({ success: false, message: "Webhook handler failed." });
  }
}
