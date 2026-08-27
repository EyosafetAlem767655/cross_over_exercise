import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { createEventSchema, updateEventSchema } from "../lib/validations.js";
import { authenticate, requireOrganizer } from "../middleware/auth.js";
import { calculateRefund } from "../lib/refund.js";
import { decrementCapacity } from "../lib/capacity.js";

const router = Router();

// GET /api/events - List all published events (public)
// Supports optional ?category=MUSIC filter
router.get("/", async (req, res) => {
  try {
    const where: Record<string, unknown> = { status: "PUBLISHED" };

    if (req.query.category && typeof req.query.category === "string") {
      where.category = req.query.category.toUpperCase();
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { date: "asc" },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({ success: true, data: events });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to fetch events",
    });
  }
});

// GET /api/events/all - List all events for organizer
router.get("/all", authenticate, requireOrganizer, async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { organizerId: req.user!.userId },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: events });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to fetch events",
    });
  }
});

// GET /api/events/:id - Get event details (public)
router.get("/:id", async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id as string },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
          },
        },
        seatTiers: {
          orderBy: { price: "asc" },
        },
      },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Event not found",
      });
    }

    res.json({ success: true, data: event });
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to fetch event",
    });
  }
});

// POST /api/events - Create new event (organizer only)
router.post("/", authenticate, requireOrganizer, async (req, res) => {
  try {
    const result = createEventSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: result.error.errors[0].message,
      });
    }

    const {
      name, description, date, time, venue, imageUrl, artistInfo,
      price, capacity, category, refundPolicy, serviceFeePercent,
    } = result.data;

    const event = await prisma.event.create({
      data: {
        name,
        description,
        date: new Date(date),
        time,
        venue,
        imageUrl: imageUrl || null,
        artistInfo: artistInfo || null,
        price,
        capacity,
        category: category || "OTHER",
        refundPolicy: refundPolicy || "TIERED",
        serviceFeePercent: serviceFeePercent ?? 5,
        status: "DRAFT",
        organizerId: req.user!.userId,
      },
    });

    res.status(201).json({
      success: true,
      data: event,
      message: "Event created successfully",
    });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to create event",
    });
  }
});

// PUT /api/events/:id - Update event (organizer only)
router.put("/:id", authenticate, requireOrganizer, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id as string },
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
        message: "You can only update your own events",
      });
    }

    const result = updateEventSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: result.error.errors[0].message,
      });
    }

    const updateData: Record<string, unknown> = {};
    const {
      name, description, date, time, venue, imageUrl, artistInfo,
      price, capacity, status, category, refundPolicy, serviceFeePercent,
    } = result.data;

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = new Date(date);
    if (time !== undefined) updateData.time = time;
    if (venue !== undefined) updateData.venue = venue;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
    if (artistInfo !== undefined) updateData.artistInfo = artistInfo || null;
    if (price !== undefined) updateData.price = price;
    if (capacity !== undefined) updateData.capacity = capacity;
    if (status !== undefined) updateData.status = status;
    if (category !== undefined) updateData.category = category;
    if (refundPolicy !== undefined) updateData.refundPolicy = refundPolicy;
    if (serviceFeePercent !== undefined) updateData.serviceFeePercent = serviceFeePercent;

    const updatedEvent = await prisma.event.update({
      where: { id: req.params.id as string },
      data: updateData,
    });

    res.json({
      success: true,
      data: updatedEvent,
      message: "Event updated successfully",
    });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to update event",
    });
  }
});

// DELETE /api/events/:id - Cancel event with batch refunds (organizer only)
// Cancels all confirmed bookings and issues full refunds (minus service fee)
// since the organizer initiated the cancellation.
router.delete("/:id", authenticate, requireOrganizer, async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: req.params.id as string },
      });

      if (!event) {
        throw new Error("NOT_FOUND:Event not found");
      }

      if (event.organizerId !== req.user!.userId) {
        throw new Error("FORBIDDEN:You can only cancel your own events");
      }

      if (event.status === "CANCELLED") {
        throw new Error("ALREADY_CANCELLED:This event has already been cancelled");
      }

      // Find all confirmed bookings for this event
      const confirmedBookings = await tx.booking.findMany({
        where: {
          eventId: req.params.id as string,
          status: "CONFIRMED",
        },
        include: {
          seatTier: true,
        },
      });

      let totalRefundAmount = 0;

      // Cancel each booking with full refund (organizer-initiated cancellation)
      for (const booking of confirmedBookings) {
        // Organizer-initiated: attendees get full refund minus service fee
        const refund = calculateRefund(
          booking.pricePaid,
          new Date(event.date),
          "FULL_REFUND",
          event.serviceFeePercent
        );

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: "CANCELLED",
            refundAmount: refund.finalRefund,
            cancelledAt: new Date(),
          },
        });

        totalRefundAmount += refund.finalRefund;

        // Decrement capacity using centralized helper
        await decrementCapacity(tx, booking);

        // Restore promo code usage if one was applied
        if (booking.promoCodeId) {
          await tx.promoCode.update({
            where: { id: booking.promoCodeId },
            data: { usageCount: { decrement: 1 } },
          });
        }
      }

      // Set event status to CANCELLED and reset sold count
      await tx.event.update({
        where: { id: req.params.id as string },
        data: {
          status: "CANCELLED",
          soldCount: 0,
        },
      });

      return {
        totalBookingsCancelled: confirmedBookings.length,
        totalRefundAmount: Math.round(totalRefundAmount * 100) / 100,
      };
    });

    res.json({
      success: true,
      message: "Event cancelled successfully",
      data: result,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error cancelling event:", err);

    if (err.message?.startsWith("NOT_FOUND:")) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: err.message.split(":")[1],
      });
    }

    if (err.message?.startsWith("FORBIDDEN:")) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: err.message.split(":")[1],
      });
    }

    if (err.message?.startsWith("ALREADY_CANCELLED:")) {
      return res.status(400).json({
        success: false,
        error: "ALREADY_CANCELLED",
        message: err.message.split(":")[1],
      });
    }

    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to cancel event",
    });
  }
});

// GET /api/events/:id/attendees - List event attendees (organizer only)
router.get("/:id/attendees", authenticate, requireOrganizer, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id as string },
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
        message: "You can only view attendees for your own events",
      });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        eventId: req.params.id as string,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        seatTier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const attendees = bookings.map((booking) => ({
      bookingId: booking.id,
      ticketCode: booking.ticketCode,
      status: booking.status,
      pricePaid: booking.pricePaid,
      seatTier: booking.seatTier,
      checkedInAt: booking.checkedInAt,
      bookedAt: booking.createdAt,
      user: booking.user,
    }));

    res.json({ success: true, data: attendees });
  } catch (error) {
    console.error("Error fetching attendees:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to fetch attendees",
    });
  }
});

export default router;
