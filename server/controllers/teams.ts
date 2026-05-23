import { Response } from "express";
import crypto from "crypto";
import { db, Team, User } from "../models/db.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";

export async function createTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, questions, standupTime, timezone, deadline, theme, emoji } = req.body;
    if (!name) {
      res.status(400).json({ success: false, message: "Team name is required" });
      return;
    }

    const userId = req.user!.id;
    const teamId = crypto.randomUUID();
    const inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 characters unique readable code

    const newTeam: Team = {
      id: teamId,
      name: name.trim(),
      inviteCode,
      ownerId: userId,
      settings: {
        questions: Array.isArray(questions) && questions.length > 0 ? questions : [
          "What did you manage to accomplish yesterday?",
          "What is your target objective for today?",
          "Are there any core blockers or dependencies delaying you?"
        ],
        standupTime: standupTime || "09:30",
        timezone: timezone || "UTC",
        deadline: deadline || "11:00",
        theme: theme || "emerald",
        emoji: emoji || "🚀",
        weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri"]
      },
      vacationUsers: []
    };

    // Save Team
    const teams = db.getTeams();
    db.saveTeams([...teams, newTeam]);

    // Add team to user's team array
    const users = db.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      if (!users[userIndex].teams.includes(teamId)) {
        users[userIndex].teams.push(teamId);
      }
      db.saveUsers(users);
    }

    res.status(201).json({
      success: true,
      message: "Team successfully bootstrapped",
      data: {
        team: newTeam
      }
    });
  } catch (error) {
    console.error("Create team controller error:", error);
    res.status(500).json({ success: false, message: "Failed to instantiate team" });
  }
}

export async function joinTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
      res.status(400).json({ success: false, message: "Invite code is required" });
      return;
    }

    const trimmedCode = inviteCode.trim().toUpperCase();
    const teams = db.getTeams();
    const team = teams.find(t => t.inviteCode === trimmedCode);
    if (!team) {
      res.status(404).json({ success: false, message: "Invalid invite code" });
      return;
    }

    const userId = req.user!.id;

    // Check if already in team
    const users = db.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      res.status(404).json({ success: false, message: "Authenticated user not found" });
      return;
    }

    if (users[userIndex].teams.includes(team.id)) {
      res.status(400).json({ success: false, message: "You are already a member of this team" });
      return;
    }

    // Add team ID to user
    users[userIndex].teams.push(team.id);
    db.saveUsers(users);

    res.status(200).json({
      success: true,
      message: `Successfully joined ${team.name}!`,
      data: {
        team
      }
    });
  } catch (error) {
    console.error("Join team controller error:", error);
    res.status(500).json({ success: false, message: "Failed to join team" });
  }
}

export async function getMyTeams(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const users = db.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const allTeams = db.getTeams();
    const myTeams = allTeams.filter(t => user.teams.includes(t.id));

    res.status(200).json({
      success: true,
      data: {
        teams: myTeams
      }
    });
  } catch (error) {
    console.error("Get my teams controller error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch your teams" });
  }
}

export async function getTeamMembers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const allTeams = db.getTeams();
    const team = allTeams.find(t => t.id === teamId);
    if (!team) {
      res.status(404).json({ success: false, message: "Team not found" });
      return;
    }

    const allUsers = db.getUsers();
    const members = allUsers
      .filter(u => u.teams.includes(teamId))
      .map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        streak: u.streak,
        badges: u.badges,
        isVacation: team.vacationUsers.includes(u.id)
      }));

    res.status(200).json({
      success: true,
      data: {
        members
      }
    });
  } catch (error) {
    console.error("Get team members controller error:", error);
    res.status(500).json({ success: false, message: "Failed to load team members" });
  }
}

export async function toggleVacation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const userId = req.user!.id;
    
    const teams = db.getTeams();
    const teamIndex = teams.findIndex(t => t.id === teamId);
    if (teamIndex === -1) {
      res.status(404).json({ success: false, message: "Team not found" });
      return;
    }

    const team = teams[teamIndex];
    const userInVacationIndex = team.vacationUsers.indexOf(userId);
    let isOOO = false;

    if (userInVacationIndex !== -1) {
      team.vacationUsers.splice(userInVacationIndex, 1);
    } else {
      team.vacationUsers.push(userId);
      isOOO = true;
    }

    db.saveTeams(teams);

    res.status(200).json({
      success: true,
      message: isOOO ? "Out of Office status set" : "Back to Office status set",
      data: {
        isVacation: isOOO,
        vacationUsers: team.vacationUsers
      }
    });
  } catch (error) {
    console.error("Toggle vacation controller error:", error);
    res.status(500).json({ success: false, message: "Failed to toggle vacation status" });
  }
}

export async function updateTeamSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    const { 
      name, 
      questions, 
      standupTime, 
      deadline, 
      timezone, 
      theme, 
      emoji, 
      weekdays,
      remindersEnabled,
      slackChannel,
      emailMailingList,
      webhookUrl,
      webhookToken
    } = req.body;

    const teams = db.getTeams();
    const teamIndex = teams.findIndex(t => t.id === teamId);
    if (teamIndex === -1) {
      res.status(404).json({ success: false, message: "Team not found" });
      return;
    }

    const team = teams[teamIndex];
    
    // Check auth permission (Only Team Owner OR Managers/Admins can update)
    const isOwner = team.ownerId === req.user!.id;
    const isAdminOrManager = req.user!.role === "Admin" || req.user!.role === "Manager";

    if (!isOwner && !isAdminOrManager) {
      res.status(403).json({ success: false, message: "Forbidden: Only owners, managers, or admins can tweak team schedules" });
      return;
    }

    if (name && name.trim()) {
      team.name = name.trim();
    }
    if (questions && Array.isArray(questions) && questions.length > 0) {
      team.settings.questions = questions;
    }
    if (standupTime) team.settings.standupTime = standupTime;
    if (deadline) team.settings.deadline = deadline;
    if (timezone) team.settings.timezone = timezone;
    if (theme) team.settings.theme = theme;
    if (emoji) team.settings.emoji = emoji;
    if (weekdays && Array.isArray(weekdays)) {
      team.settings.weekdays = weekdays;
    }
    
    // Support new features
    if (typeof remindersEnabled === "boolean") team.settings.remindersEnabled = remindersEnabled;
    if (typeof slackChannel === "string") team.settings.slackChannel = slackChannel;
    if (typeof emailMailingList === "string") team.settings.emailMailingList = emailMailingList;
    if (typeof webhookUrl === "string") team.settings.webhookUrl = webhookUrl;
    if (typeof webhookToken === "string") team.settings.webhookToken = webhookToken;

    db.saveTeams(teams);

    res.status(200).json({
      success: true,
      message: "Team schedule settings updated successfully",
      data: {
        team
      }
    });
  } catch (error) {
    console.error("Update team settings controller error:", error);
    res.status(500).json({ success: false, message: "Failed to modify team schedule settings" });
  }
}

export async function deleteTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId } = req.params;
    
    const teams = db.getTeams();
    const teamIndex = teams.findIndex(t => t.id === teamId);
    if (teamIndex === -1) {
      res.status(404).json({ success: false, message: "Workspace not found" });
      return;
    }

    const team = teams[teamIndex];
    const isOwner = team.ownerId === req.user!.id;
    const isAdmin = req.user!.role === "Admin";

    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: "Forbidden: Only the team owner or an Admin can delete this workspace" });
      return;
    }

    // Remove team from teams collection
    const updatedTeams = teams.filter(t => t.id !== teamId);
    db.saveTeams(updatedTeams);

    // Remove teamId from all users' teams array
    const users = db.getUsers();
    users.forEach(u => {
      u.teams = u.teams.filter(id => id !== teamId);
    });
    db.saveUsers(users);

    // Clean up associated standups
    const standups = db.getStandups();
    const filteredStandups = standups.filter(s => s.teamId !== teamId);
    db.saveStandups(filteredStandups);

    // Clean up associated insights
    const insights = db.getInsights();
    const filteredInsights = insights.filter(i => i.teamId !== teamId);
    db.saveInsights(filteredInsights);

    res.status(200).json({
      success: true,
      message: `Workspace "${team.name}" and all historical data successfully purged`
    });
  } catch (error) {
    console.error("Delete team controller error:", error);
    res.status(500).json({ success: false, message: "Failed to delete team workspace" });
  }
}

export async function updateUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { teamId, userId } = req.params;
    const { role } = req.body;

    if (!role || !["Admin", "Manager", "Member"].includes(role)) {
      res.status(400).json({ success: false, message: "Invalid role value. Must be Admin, Manager, or Member" });
      return;
    }

    const formatRole = role as "Admin" | "Manager" | "Member";

    const teams = db.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      res.status(404).json({ success: false, message: "Team not found" });
      return;
    }

    // Only Owner of team or System Admin can change roles of members
    const isOwner = team.ownerId === req.user!.id;
    const isAdmin = req.user!.role === "Admin";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: "Forbidden: Only team owners or system administrators can re-assign roles" });
      return;
    }

    const users = db.getUsers();
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      res.status(404).json({ success: false, message: "Member user not found" });
      return;
    }

    targetUser.role = formatRole;
    db.saveUsers(users);

    res.status(200).json({
      success: true,
      message: `Successfully updated ${targetUser.name}'s workspace role to ${formatRole}.`,
      data: {
        userId,
        role: formatRole
      }
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({ success: false, message: "Failed to update member role" });
  }
}
