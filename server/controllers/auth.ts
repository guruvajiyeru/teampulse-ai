import crypto from "crypto";
import { Request, Response } from "express";
import { db } from "../models/db.js";
import { hashPassword, generateToken } from "../utils/auth.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";

function getEarnedBadges(streak: number, totalSubmissions: number): string[] {
  const badges = ["Inception"];
  if (streak >= 3) badges.push("Streak Starter (3 Days)");
  if (streak >= 5) badges.push("Consistency Hero (5 Days)");
  if (streak >= 10) badges.push("SaaS Professional (10 Days)");
  if (totalSubmissions >= 1) badges.push("First Standup");
  if (totalSubmissions >= 15) badges.push("Team Catalyst");
  return badges;
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ success: false, message: "Email, password, and name are required" });
      return;
    }

    const formattedEmail = email.toLowerCase().trim();
    const users = db.getUsers();

    if (users.find(u => u.email === formattedEmail)) {
      res.status(400).json({ success: false, message: "An account with this email already exists" });
      return;
    }

    const assignedRole = users.length === 0 ? "Admin" : (role === "Admin" || role === "Manager" ? role : "Member");

    const newUser = {
      id: crypto.randomUUID(),
      email: formattedEmail,
      passwordHash: hashPassword(password),
      name: name.trim(),
      role: assignedRole as "Admin" | "Manager" | "Member",
      teams: [],
      streak: 0,
      lastSubmissionDate: null,
      badges: ["Inception"],
      avatar: "🦊",
      timezone: "UTC",
      notificationSettings: { emailDigest: true, slackWebhookAlerts: false, dailyReminders: true }
    };

    db.saveUsers([...users, newUser]);
    const token = generateToken({ id: newUser.id, email: newUser.email, role: newUser.role });

    res.status(201).json({ success: true, message: "Registration successful", data: { token, user: newUser } });
  } catch (error) {
    console.error("Register controller error:", error);
    res.status(500).json({ success: false, message: "Registration failed on server" });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: "Email and password are required" });
      return;
    }

    const formattedEmail = email.toLowerCase().trim();
    const users = db.getUsers();
    const user = users.find(u => u.email === formattedEmail);

    if (!user || user.passwordHash !== hashPassword(password)) {
      res.status(401).json({ success: false, message: "Invalid email or password" });
      return;
    }

    const standups = db.getStandups().filter(s => s.userId === user.id && !s.isDraft);
    user.badges = getEarnedBadges(user.streak, standups.length);
    db.saveUsers(users);

    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    res.status(200).json({ success: true, message: "Login successful", data: { token, user } });
  } catch (error) {
    console.error("Login controller error:", error);
    res.status(500).json({ success: false, message: "Login failed on server" });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }
    const user = db.getUsers().find(u => u.id === req.user!.id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    console.error("GetMe controller error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
}

export async function updateUserProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }
    const { name, role, avatar, timezone, notificationSettings } = req.body;
    const users = db.getUsers();
    const idx = users.findIndex(u => u.id === req.user!.id);
    if (idx === -1) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    if (name) users[idx].name = name.trim();
    if (role && ["Manager", "Member"].includes(role)) users[idx].role = role;
    if (avatar !== undefined) users[idx].avatar = avatar;
    if (timezone !== undefined) users[idx].timezone = timezone;
    if (notificationSettings !== undefined) users[idx].notificationSettings = {
      emailDigest: !!notificationSettings.emailDigest,
      slackWebhookAlerts: !!notificationSettings.slackWebhookAlerts,
      dailyReminders: !!notificationSettings.dailyReminders
    };
    db.saveUsers(users);
    res.status(200).json({ success: true, message: "Profile updated successfully", data: { user: users[idx] } });
  } catch (error) {
    console.error("Update profile controller error:", error);
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
}

export async function oauthLogin(req: Request, res: Response): Promise<void> {
  try {
    const { provider, email, name, avatar } = req.body;
    if (!provider || !email || !name) {
      res.status(400).json({ success: false, message: "Provider, Email and Name are required" });
      return;
    }

    const formattedEmail = email.toLowerCase().trim();
    const users = db.getUsers();
    let user = users.find(u => u.email === formattedEmail);

    if (!user) {
      user = {
        id: crypto.randomUUID(),
        email: formattedEmail,
        passwordHash: hashPassword(crypto.randomUUID()),
        name,
        role: "Member",
        teams: [],
        streak: 0,
        lastSubmissionDate: null,
        badges: ["Inception", "OAuth Connected"],
        avatar: avatar || "🤖",
        timezone: "UTC",
        notificationSettings: { emailDigest: true, slackWebhookAlerts: false, dailyReminders: true }
      };
      db.saveUsers([...users, user]);
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    res.status(200).json({ success: true, message: `Connected with ${provider}`, data: { token, user } });
  } catch (error) {
    console.error("OAuth login controller error:", error);
    res.status(500).json({ success: false, message: "OAuth authorization failed" });
  }
}
