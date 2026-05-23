import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/auth.js";
import { db, User } from "../models/db.js";

// Extend Express Request interface to include user information
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "Admin" | "Manager" | "Member";
    name: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ success: false, message: "Authorization token required" });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ success: false, message: "Invalid or expired authorization token" });
      return;
    }

    // Double check user exists in DB
    const users = db.getUsers();
    const user = users.find(u => u.id === decoded.id);
    if (!user) {
      res.status(401).json({ success: false, message: "User account no longer exists" });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ success: false, message: "Internal server authentication error" });
  }
}

export function roleMiddleware(allowedRoles: ("Admin" | "Manager" | "Member")[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, message: "User context not authenticated" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: "Access forbidden: insufficient privilege level" });
      return;
    }

    next();
  };
}
