import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireOrganizer } from "../middleware/auth.js";
import { reassignBookingSchema } from "../lib/validations.js";
import { transferBooking } from "../lib/transfer.js";

const router = Router();

// GET /api/dashboard/stats - Get overall statistics
router.get("/stats", authenticate, requireOrganizer, async (req, res) => {
  try {
    const [events, allBookings] = await Promise.all([
      prisma.event.findMany({
        where: { organizerId: req.user!.userId },
        select: {
          id: true,
          price: true,
          soldCount: true,
          status: true,
          category: true,
        },
      }),
      prisma.booking.findMany({
        where: {
          event: { organizerId: req.user!.userId },
        },
        select: {
          status: true,
          pricePaid: true,
          refundAmount: true,
          createdAt: true,
          event: {
            select: { price: true, category: true },
          },
        },
      }),
    ]);

    const activeBookings = allBookings.filter(
      (b) => b.status === "CONFIRMED" || b.status === "CHECKED_IN"
    );
    const cancelledBookings = allBookings.filter((b) => b.status === "CANCELLED");
    const waitlistedCount = allBookings.filter((b) => b.status === "WAITLISTED").length;

    const totalEvents = events.filter((e) => e.status !== "CANCELLED").length;
    const totalTicketsSold = activeBookings.length;
    const grossRevenue = activeBookings.reduce((sum, b) => sum + b.pricePaid, 0);
    const totalRefunds = cancelledBookings.reduce((sum, b) => sum + b.refundAmount, 0);
    const totalRefundCount = cancelledBookings.length;
    const netRevenue = Math.round((grossRevenue - totalRefunds) * 100) / 100;
    const totalCheckedIn = activeBookings.filter((b) => b.status === "CHECKED_IN").length;
    const attendanceRate =
      totalTicketsSold > 0 ? Math.round((totalCheckedIn / totalTicketsSold) * 100) : 0;

    // Category breakdown
    const categoryBreakdown: Record<string, { events: number; tickets: number; revenue: number }> =
      {};
    events.forEach((e) => {
      if (e.status === "CANCELLED") return;
      if (!categoryBreakdown[e.category]) {
        categoryBreakdown[e.category] = { events: 0, tickets: 0, revenue: 0 };
      }
      categoryBreakdown[e.category].events++;
    });
    activeBookings.forEach((b) => {
      const cat = b.event.category;
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { events: 0, tickets: 0, revenue: 0 };
      }
      categoryBreakdown[cat].tickets++;
      categoryBreakdown[cat].revenue += b.pricePaid;
    });

    // Get recent sales (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentBookings = activeBookings.filter((b) => b.createdAt >= sevenDaysAgo);
    const salesByDate: Record<string, { count: number; revenue: number }> = {};

    recentBookings.forEach((b) => {
      const dateKey = b.createdAt.toISOString().split("T")[0];
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = { count: 0, revenue: 0 };
      }
      salesByDate[dateKey].count++;
      salesByDate[dateKey].revenue += b.pricePaid;
    });

    const recentSales = Object.entries(salesByDate)
      .map(([date, data]) => ({
        date,
        count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        totalEvents,
        totalTicketsSold,
        grossRevenue,
        netRevenue,
        totalRevenue: netRevenue,
        totalRefunds,
        totalRefundCount,
        totalCheckedIn,
        attendanceRate,
        waitlistedCount,
        categoryBreakdown,
        recentSales,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to fetch statistics",
    });
  }
});

// GET /api/dashboard/events/:id/stats - Get event statistics with tier breakdown
router.get("/events/:id/stats", authenticate, requireOrganizer, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id as string },
      include: {
        seatTiers: true,
        promoCodes: {
          select: {
            id: true,
            code: true,
            discountType: true,
            discountValue: true,
            usageCount: true,
            usageLimit: true,
            isActive: true,
          },
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

    if (event.organizerId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "You can only view stats for your own events",
      });
    }

    const allBookings = await prisma.booking.findMany({
      where: { eventId: req.params.id as string },
      select: {
        status: true,
        pricePaid: true,
        discountAmount: true,
        refundAmount: true,
        createdAt: true,
        seatTierId: true,
        promoCodeId: true,
      },
    });

    const activeBookings = allBookings.filter(
      (b) => b.status === "CONFIRMED" || b.status === "CHECKED_IN"
    );
    const cancelledBookings = allBookings.filter((b) => b.status === "CANCELLED");

    const ticketsSold = activeBookings.length;
    const revenue = activeBookings.reduce((sum, b) => sum + b.pricePaid, 0);
    const totalDiscounts = allBookings.reduce((sum, b) => sum + b.discountAmount, 0);
    const totalRefunds = cancelledBookings.reduce((sum, b) => sum + b.refundAmount, 0);
    const totalRefundCount = cancelledBookings.length;
    const checkedIn = activeBookings.filter((b) => b.status === "CHECKED_IN").length;
    const attendanceRate = ticketsSold > 0 ? Math.round((checkedIn / ticketsSold) * 100) : 0;
    const remainingCapacity = event.capacity - event.soldCount;

    // Per-tier breakdown
    const tierBreakdown = event.seatTiers.map((tier) => {
      const tierBookings = activeBookings.filter((b) => b.seatTierId === tier.id);
      return {
        tierId: tier.id,
        tierName: tier.name,
        tierPrice: tier.price,
        capacity: tier.capacity,
        soldCount: tier.soldCount,
        ticketsSold: tierBookings.length,
        revenue: tierBookings.reduce((sum, b) => sum + b.pricePaid, 0),
        remainingCapacity: tier.capacity - tier.soldCount,
      };
    });

    // Promo code usage summary
    const promoCodeStats = event.promoCodes.map((promo) => {
      const promoBookings = activeBookings.filter((b) => b.promoCodeId === promo.id);
      return {
        codeId: promo.id,
        code: promo.code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        usageCount: promo.usageCount,
        usageLimit: promo.usageLimit,
        isActive: promo.isActive,
        totalDiscountGiven: promoBookings.reduce((sum, b) => sum + b.discountAmount, 0),
      };
    });

    // Sales by hour (for velocity)
    const salesByHour: Record<string, number> = {};
    activeBookings.forEach((b) => {
      const hourKey = b.createdAt.toISOString().slice(0, 13);
      salesByHour[hourKey] = (salesByHour[hourKey] || 0) + 1;
    });

    const salesVelocity = Object.entries(salesByHour)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .slice(-24);

    res.json({
      success: true,
      data: {
        ticketsSold,
        revenue,
        totalDiscounts,
        totalRefunds,
        totalRefundCount,
        checkedIn,
        attendanceRate,
        remainingCapacity,
        capacity: event.capacity,
        salesVelocity,
        tierBreakdown,
        promoCodeStats,
      },
    });
  } catch (error) {
    console.error("Error fetching event stats:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to fetch event statistics",
    });
  }
});

// GET /api/dashboard/velocity - Get sales velocity data
router.get("/velocity", authenticate, requireOrganizer, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const bookings = await prisma.booking.findMany({
      where: {
        event: { organizerId: req.user!.userId },
        createdAt: { gte: twentyFourHoursAgo },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
      select: {
        createdAt: true,
        pricePaid: true,
      },
    });

    const salesByHour: Record<string, { count: number; revenue: number }> = {};

    // Initialize all 24 hours
    for (let i = 0; i < 24; i++) {
      const hour = new Date();
      hour.setHours(hour.getHours() - i);
      const hourKey = hour.toISOString().slice(0, 13);
      salesByHour[hourKey] = { count: 0, revenue: 0 };
    }

    bookings.forEach((b) => {
      const hourKey = b.createdAt.toISOString().slice(0, 13);
      if (salesByHour[hourKey]) {
        salesByHour[hourKey].count++;
        salesByHour[hourKey].revenue += b.pricePaid;
      }
    });

    const velocity = Object.entries(salesByHour)
      .map(([hour, data]) => ({
        hour,
        count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    res.json({
      success: true,
      data: velocity,
    });
  } catch (error) {
    console.error("Error fetching velocity:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to fetch sales velocity",
    });
  }
});

// POST /api/dashboard/events/:id/bookings/:bookingId/reassign - Reassign ticket to another user (organizer only)
// Uses the shared transferBooking() utility which handles the cancel+create pattern,
// capacity adjustments, and fresh ticket generation. All booking ownership changes
// should go through transferBooking() for consistency.
router.post(
  "/events/:id/bookings/:bookingId/reassign",
  authenticate,
  requireOrganizer,
  async (req, res) => {
    try {
      const result = reassignBookingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: result.error.errors[0].message,
        });
      }

      const { recipientEmail } = result.data;

      const newBooking = await prisma.$transaction(async (tx) => {
        // Verify the event belongs to this organizer
        const event = await tx.event.findUnique({
          where: { id: req.params.id as string },
        });

        if (!event) {
          throw new Error("NOT_FOUND:Event not found");
        }

        if (event.organizerId !== req.user!.userId) {
          throw new Error("FORBIDDEN:You can only reassign tickets for your own events");
        }

        // Find the booking
        const booking = await tx.booking.findUnique({
          where: { id: req.params.bookingId as string },
        });

        if (!booking || booking.eventId !== (req.params.id as string)) {
          throw new Error("NOT_FOUND:Booking not found");
        }

        // Find the recipient user
        const recipient = await tx.user.findUnique({
          where: { email: recipientEmail },
        });

        if (!recipient) {
          throw new Error("NOT_FOUND:No user found with that email address");
        }

        if (recipient.id === booking.userId) {
          throw new Error("VALIDATION:Cannot reassign a ticket to the current holder");
        }

        // Check if recipient already has a ticket for this event
        const existingBooking = await tx.booking.findFirst({
          where: {
            userId: recipient.id,
            eventId: req.params.id as string,
            status: "CONFIRMED",
          },
        });

        if (existingBooking) {
          throw new Error("DUPLICATE:Recipient already has a ticket for this event");
        }

        // Use the shared transfer utility for the actual ownership change
        return await transferBooking(tx, booking.id, recipient.id);
      });

      res.json({
        success: true,
        data: newBooking,
        message: "Ticket reassigned successfully",
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error reassigning ticket:", err);

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

      if (err.message?.startsWith("INVALID_STATUS:")) {
        return res.status(400).json({
          success: false,
          error: "INVALID_STATUS",
          message: err.message.split(":")[1],
        });
      }

      if (err.message?.startsWith("VALIDATION:")) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: err.message.split(":")[1],
        });
      }

      if (err.message?.startsWith("DUPLICATE:")) {
        return res.status(409).json({
          success: false,
          error: "DUPLICATE",
          message: err.message.split(":")[1],
        });
      }

      res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR",
        message: "Failed to reassign ticket",
      });
    }
  }
);

export default router;
