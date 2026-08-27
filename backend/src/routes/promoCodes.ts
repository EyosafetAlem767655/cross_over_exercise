import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { createPromoCodeSchema } from "../lib/validations.js";
import { authenticate, requireOrganizer } from "../middleware/auth.js";

const router = Router();

// GET /api/events/:eventId/promo-codes - List promo codes (organizer only)
router.get("/:eventId/promo-codes", authenticate, requireOrganizer, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId as string },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Event not found",
      });
    }

    if (event.organizerId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "You can only view promo codes for your own events",
      });
    }

    const promoCodes = await prisma.promoCode.findMany({
      where: { eventId: req.params.eventId as string },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: promoCodes });
  } catch (error) {
    console.error("Error fetching promo codes:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to fetch promo codes",
    });
  }
});

// POST /api/events/:eventId/promo-codes - Create promo code (organizer only)
router.post("/:eventId/promo-codes", authenticate, requireOrganizer, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId as string },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Event not found",
      });
    }

    if (event.organizerId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "You can only manage promo codes for your own events",
      });
    }

    const result = createPromoCodeSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: result.error.errors[0].message,
      });
    }

    const {
      code, discountType, discountValue, usageLimit,
      validFrom, validUntil, minPurchaseAmount, maxDiscountAmount,
    } = result.data;

    // Validate: percentage discounts cannot exceed 100%
    if (discountType === "PERCENTAGE" && discountValue > 100) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Percentage discount cannot exceed 100%",
      });
    }

    // Validate: validFrom must be before validUntil
    if (validFrom && validUntil && new Date(validFrom) >= new Date(validUntil)) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Valid from date must be before valid until date",
      });
    }

    // Check for duplicate code on this event
    const existing = await prisma.promoCode.findUnique({
      where: {
        eventId_code: { eventId: req.params.eventId as string, code: code.toUpperCase() },
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: "DUPLICATE",
        message: "A promo code with this name already exists for this event",
      });
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        discountType,
        discountValue,
        usageLimit: usageLimit || null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        minPurchaseAmount: minPurchaseAmount ?? null,
        maxDiscountAmount: maxDiscountAmount ?? null,
        eventId: req.params.eventId as string,
      },
    });

    res.status(201).json({
      success: true,
      data: promoCode,
      message: "Promo code created successfully",
    });
  } catch (error) {
    console.error("Error creating promo code:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to create promo code",
    });
  }
});

// POST /api/events/:eventId/promo-codes/validate - Validate a promo code (used at checkout)
router.post("/:eventId/promo-codes/validate", authenticate, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Promo code is required",
      });
    }

    const promoCode = await prisma.promoCode.findUnique({
      where: {
        eventId_code: { eventId: req.params.eventId as string, code: code.toUpperCase() },
      },
    });

    if (!promoCode || !promoCode.isActive) {
      return res.status(404).json({
        success: false,
        error: "INVALID_CODE",
        message: "Invalid promo code",
      });
    }

    if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
      return res.status(400).json({
        success: false,
        error: "CODE_EXHAUSTED",
        message: "This code has reached its usage limit",
      });
    }

    // Check date validity
    const now = new Date();
    if (promoCode.validFrom && now < new Date(promoCode.validFrom)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_CODE",
        message: "This promo code is not yet active",
      });
    }
    if (promoCode.validUntil && now > new Date(promoCode.validUntil)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_CODE",
        message: "This promo code has expired",
      });
    }

    res.json({
      success: true,
      data: {
        id: promoCode.id,
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        minPurchaseAmount: promoCode.minPurchaseAmount,
        maxDiscountAmount: promoCode.maxDiscountAmount,
      },
    });
  } catch (error) {
    console.error("Error validating promo code:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to validate promo code",
    });
  }
});

// DELETE /api/events/:eventId/promo-codes/:codeId - Delete/deactivate promo code (organizer only)
router.delete("/:eventId/promo-codes/:codeId", authenticate, requireOrganizer, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId as string },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Event not found",
      });
    }

    if (event.organizerId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "You can only manage promo codes for your own events",
      });
    }

    const promoCode = await prisma.promoCode.findUnique({
      where: { id: req.params.codeId as string },
    });

    if (!promoCode || promoCode.eventId !== (req.params.eventId as string)) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Promo code not found",
      });
    }

    // Deactivate instead of delete to preserve booking references
    await prisma.promoCode.update({
      where: { id: req.params.codeId as string },
      data: { isActive: false },
    });

    res.json({ success: true, message: "Promo code deactivated successfully" });
  } catch (error) {
    console.error("Error deleting promo code:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to delete promo code",
    });
  }
});

export default router;
