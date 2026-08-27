import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Please sign in",
    });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Invalid or expired token",
    });
  }

  req.user = payload;
  next();
}

export function requireOrganizer(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Please sign in",
    });
  }

  if (req.user.role !== "ORGANIZER") {
    return res.status(403).json({
      success: false,
      error: "FORBIDDEN",
      message: "Only organizers can perform this action",
    });
  }

  next();
}

export function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.CHECKIN_API_KEY) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Invalid API key",
    });
  }

  next();
}
