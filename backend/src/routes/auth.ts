import { Router } from "express";
import { hash, compare } from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { generateToken } from "../lib/jwt.js";
import { registerSchema, loginSchema, updateProfileSchema } from "../lib/validations.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: result.error.errors[0].message,
      });
    }

    const { email, password, name } = result.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "CONFLICT",
        message: "Email already registered",
      });
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "ATTENDEE",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as "ORGANIZER" | "ATTENDEE",
    });

    res.status(201).json({
      success: true,
      data: { user, token },
      message: "Registration successful",
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Something went wrong",
    });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: result.error.errors[0].message,
      });
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as "ORGANIZER" | "ATTENDEE",
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isVerified: user.isVerified,
        },
        token,
      },
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Something went wrong",
    });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        verifiedAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "User not found",
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Something went wrong",
    });
  }
});

// PUT /api/auth/profile - Update user profile
router.put("/profile", authenticate, async (req, res) => {
  try {
    const result = updateProfileSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: result.error.errors[0].message,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Verified users cannot change their name (identity is locked after verification)
    if (result.data.name && user.isVerified) {
      return res.status(400).json({
        success: false,
        error: "PROFILE_LOCKED",
        message: "Verified users cannot change their name. Contact support if you need to update your identity.",
      });
    }

    const updateData: Record<string, unknown> = {};
    if (result.data.name !== undefined) updateData.name = result.data.name;

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        verifiedAt: true,
      },
    });

    res.json({
      success: true,
      data: updatedUser,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to update profile",
    });
  }
});

export default router;
