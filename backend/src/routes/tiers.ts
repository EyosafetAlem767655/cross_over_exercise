import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { createTierSchema, updateTierSchema } from "../lib/validations.js";
import { authenticate, requireOrganizer } from "../middleware/auth.js";

const router = Router();

// GET /api/events/:eventId/tiers - List tiers for an event (public)
router.get("/:eventId/tiers", async (req, res) => {
  try {
    const tiers = await prisma.seatTier.findMany({
      where: { eventId: req.params.eventId as string },
      orderBy: { price: "asc" },
    });

    res.json({ success: true, data: tiers });
  } catch (error) {
    console.error("Error fetching tiers:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to fetch tiers",
    });
  }
});

// POST /api/events/:eventId/tiers - Create a tier (organizer only)
router.post("/:eventId/tiers", authenticate, requireOrganizer, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId as string },
      include: { seatTiers: true },
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
        message: "You can only manage tiers for your own events",
      });
    }

    if (event.seatTiers.length >= 4) {
      return res.status(400).json({
        success: false,
        error: "LIMIT_REACHED",
        message: "Maximum 4 tiers per event",
      });
    }

    const result = createTierSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: result.error.errors[0].message,
      });
    }

    const { name, price, capacity } = result.data;

    const tier = await prisma.seatTier.create({
      data: {
        name,
        price,
        capacity,
        eventId: req.params.eventId as string,
      },
    });

    res.status(201).json({
      success: true,
      data: tier,
      message: "Tier created successfully",
    });
  } catch (error) {
    console.error("Error creating tier:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to create tier",
    });
  }
});

// PUT /api/events/:eventId/tiers/:tierId - Update a tier (organizer only)
router.put("/:eventId/tiers/:tierId", authenticate, requireOrganizer, async (req, res) => {
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
        message: "You can only manage tiers for your own events",
      });
    }

    const tier = await prisma.seatTier.findUnique({
      where: { id: req.params.tierId as string },
    });

    if (!tier || tier.eventId !== req.params.eventId as string) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Tier not found",
      });
    }

    const result = updateTierSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: result.error.errors[0].message,
      });
    }

    const updateData: Record<string, unknown> = {};
    if (result.data.name !== undefined) updateData.name = result.data.name;
    if (result.data.price !== undefined) updateData.price = result.data.price;
    if (result.data.capacity !== undefined) updateData.capacity = result.data.capacity;

    const updatedTier = await prisma.seatTier.update({
      where: { id: req.params.tierId as string },
      data: updateData,
    });

    res.json({
      success: true,
      data: updatedTier,
      message: "Tier updated successfully",
    });
  } catch (error) {
    console.error("Error updating tier:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to update tier",
    });
  }
});

// DELETE /api/events/:eventId/tiers/:tierId - Delete a tier (organizer only)
router.delete("/:eventId/tiers/:tierId", authenticate, requireOrganizer, async (req, res) => {
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
        message: "You can only manage tiers for your own events",
      });
    }

    const tier = await prisma.seatTier.findUnique({
      where: { id: req.params.tierId as string },
    });

    if (!tier || tier.eventId !== req.params.eventId as string) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Tier not found",
      });
    }

    if (tier.soldCount > 0) {
      return res.status(400).json({
        success: false,
        error: "HAS_BOOKINGS",
        message: "Cannot delete a tier that has sold tickets",
      });
    }

    await prisma.seatTier.delete({
      where: { id: req.params.tierId as string },
    });

    res.json({ success: true, message: "Tier deleted successfully" });
  } catch (error) {
    console.error("Error deleting tier:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to delete tier",
    });
  }
});

export default router;
