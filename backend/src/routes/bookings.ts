import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { createBookingSchema } from "../lib/validations.js";
import { authenticate } from "../middleware/auth.js";
import { generateTicketCode, generateQRData, generateQRCodeDataURL } from "../lib/qr.js";
import { calculateRefund } from "../lib/refund.js";
import { incrementCapacity, decrementCapacity } from "../lib/capacity.js";

// Booking ownership changes: see lib/transfer.ts for the cancel+create utility
// used by organizer reassignment. For attendee-initiated transfers, consider
// whether the full cancel+create cycle is needed or if a simpler ownership
// update would suffice — see the NOTE in transfer.ts for trade-offs.

const router = Router();

// GET /api/bookings - List user's bookings
router.get("/", authenticate, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        userId: req.user!.userId,
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            date: true,
            time: true,
            venue: true,
            imageUrl: true,
            status: true,
            category: true,
          },
        },
        seatTier: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ success: true, data: bookings });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to fetch bookings",
    });
  }
});

// GET /api/bookings/:id - Get booking details
router.get("/:id", authenticate, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id as string },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            date: true,
            time: true,
            venue: true,
            imageUrl: true,
            artistInfo: true,
            status: true,
            category: true,
            refundPolicy: true,
            serviceFeePercent: true,
          },
        },
        seatTier: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        promoCode: {
          select: {
            id: true,
            code: true,
            discountType: true,
            discountValue: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Booking not found",
      });
    }

    if (booking.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "You can only view your own bookings",
      });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to fetch booking",
    });
  }
});

// GET /api/bookings/:id/refund-preview - Calculate refund breakdown before cancellation
router.get("/:id/refund-preview", authenticate, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id as string },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            date: true,
            refundPolicy: true,
            serviceFeePercent: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Booking not found",
      });
    }

    if (booking.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "You can only view refund details for your own bookings",
      });
    }

    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATUS",
        message:
          booking.status === "CANCELLED"
            ? "This booking has already been cancelled"
            : "Only confirmed bookings can be cancelled",
      });
    }

    const refund = calculateRefund(
      booking.pricePaid,
      new Date(booking.event.date),
      booking.event.refundPolicy,
      booking.event.serviceFeePercent
    );

    res.json({
      success: true,
      data: refund,
    });
  } catch (error) {
    console.error("Error calculating refund preview:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to calculate refund preview",
    });
  }
});

// POST /api/bookings - Create booking (buy ticket)
router.post("/", authenticate, async (req, res) => {
  try {
    const result = createBookingSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: result.error.errors[0].message,
      });
    }

    const { eventId, seatTierId, promoCode } = result.data;

    // Use transaction for atomic ticket purchase
    const booking = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { seatTiers: true },
      });

      if (!event) {
        throw new Error("NOT_FOUND:Event not found");
      }

      if (event.status !== "PUBLISHED") {
        throw new Error("INVALID_EVENT:Event is not available for booking");
      }

      // Check if user already has a booking for this event
      const existingBooking = await tx.booking.findFirst({
        where: {
          userId: req.user!.userId,
          eventId,
          status: "CONFIRMED",
        },
      });

      if (existingBooking) {
        throw new Error("DUPLICATE:You already have a ticket for this event");
      }

      // Determine price based on tier or event base price
      let ticketPrice = event.price;
      let selectedTierId: string | null = null;

      if (event.seatTiers.length > 0) {
        // Event has tiers — tier selection is required
        if (!seatTierId) {
          throw new Error("VALIDATION:Please select a seat tier");
        }

        const tier = event.seatTiers.find((t) => t.id === seatTierId);
        if (!tier) {
          throw new Error("NOT_FOUND:Selected tier not found");
        }

        if (tier.soldCount >= tier.capacity) {
          throw new Error("SOLD_OUT:Selected tier is sold out");
        }

        ticketPrice = tier.price;
        selectedTierId = tier.id;
      } else {
        // No tiers — use event-level capacity
        if (event.soldCount >= event.capacity) {
          throw new Error("SOLD_OUT:Event is sold out");
        }
      }

      // Increment capacity using centralized helper
      await incrementCapacity(tx, eventId, selectedTierId);

      // Handle promo code
      let discountAmount = 0;
      let appliedPromoId: string | null = null;

      if (promoCode) {
        const promo = await tx.promoCode.findUnique({
          where: { eventId_code: { eventId, code: promoCode.toUpperCase() } },
        });

        if (!promo || !promo.isActive) {
          throw new Error("INVALID_CODE:Invalid promo code");
        }

        if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
          throw new Error("CODE_EXHAUSTED:This code has reached its usage limit");
        }

        // Check promo code date validity
        const now = new Date();
        if (promo.validFrom && now < new Date(promo.validFrom)) {
          throw new Error("INVALID_CODE:This promo code is not yet active");
        }
        if (promo.validUntil && now > new Date(promo.validUntil)) {
          throw new Error("INVALID_CODE:This promo code has expired");
        }

        // Check minimum purchase amount
        if (promo.minPurchaseAmount && ticketPrice < promo.minPurchaseAmount) {
          throw new Error(
            `MIN_PURCHASE:Minimum purchase of $${promo.minPurchaseAmount.toFixed(2)} required for this code`
          );
        }

        // Calculate discount
        if (promo.discountType === "PERCENTAGE") {
          discountAmount = ticketPrice * (promo.discountValue / 100);
          // Apply max discount cap if set
          if (promo.maxDiscountAmount && discountAmount > promo.maxDiscountAmount) {
            discountAmount = promo.maxDiscountAmount;
          }
        } else {
          discountAmount = promo.discountValue;
        }

        // Ensure discount doesn't exceed ticket price
        discountAmount = Math.min(discountAmount, ticketPrice);

        // Increment usage count
        await tx.promoCode.update({
          where: { id: promo.id },
          data: { usageCount: { increment: 1 } },
        });

        appliedPromoId = promo.id;
      }

      const finalPrice = Math.round((ticketPrice - discountAmount) * 100) / 100;

      // Generate ticket
      const ticketCode = generateTicketCode();
      const qrCodeData = generateQRData(ticketCode);

      // Create booking
      const newBooking = await tx.booking.create({
        data: {
          ticketCode,
          qrCodeData,
          userId: req.user!.userId,
          eventId,
          seatTierId: selectedTierId,
          promoCodeId: appliedPromoId,
          pricePaid: finalPrice,
          discountAmount,
          status: "CONFIRMED",
        },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              date: true,
              time: true,
              venue: true,
            },
          },
          seatTier: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
        },
      });

      return newBooking;
    });

    res.status(201).json({
      success: true,
      data: booking,
      message: "Ticket purchased successfully",
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error creating booking:", err);

    if (err.message?.startsWith("NOT_FOUND:")) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: err.message.split(":")[1],
      });
    }

    if (err.message?.startsWith("SOLD_OUT:")) {
      return res.status(409).json({
        success: false,
        error: "SOLD_OUT",
        message: err.message.split(":")[1],
      });
    }

    if (err.message?.startsWith("INVALID_EVENT:")) {
      return res.status(400).json({
        success: false,
        error: "INVALID_EVENT",
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

    if (err.message?.startsWith("VALIDATION:")) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: err.message.split(":")[1],
      });
    }

    if (err.message?.startsWith("INVALID_CODE:")) {
      return res.status(400).json({
        success: false,
        error: "INVALID_CODE",
        message: err.message.split(":")[1],
      });
    }

    if (err.message?.startsWith("CODE_EXHAUSTED:")) {
      return res.status(400).json({
        success: false,
        error: "CODE_EXHAUSTED",
        message: err.message.split(":")[1],
      });
    }

    if (err.message?.startsWith("MIN_PURCHASE:")) {
      return res.status(400).json({
        success: false,
        error: "MIN_PURCHASE",
        message: err.message.split(":")[1],
      });
    }

    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to create booking",
    });
  }
});

// DELETE /api/bookings/:id - Cancel booking with refund calculation
router.delete("/:id", authenticate, async (req, res) => {
  try {
    // Use an interactive transaction to prevent race conditions
    // (two concurrent cancel requests for the same booking)
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: req.params.id as string },
        include: {
          event: true,
        },
      });

      if (!booking) {
        throw new Error("NOT_FOUND:Booking not found");
      }

      if (booking.userId !== req.user!.userId) {
        throw new Error("FORBIDDEN:You can only cancel your own bookings");
      }

      if (booking.status !== "CONFIRMED") {
        throw new Error(
          booking.status === "CANCELLED"
            ? "ALREADY_CANCELLED:This booking has already been cancelled"
            : "INVALID_STATUS:Only confirmed bookings can be cancelled"
        );
      }

      // Calculate refund using the shared refund engine
      const refund = calculateRefund(
        booking.pricePaid,
        new Date(booking.event.date),
        booking.event.refundPolicy,
        booking.event.serviceFeePercent
      );

      if (!refund.canCancel) {
        throw new Error("PAST_EVENT:This event has already passed. Cancellation is not allowed.");
      }

      // Update booking status and store refund amount + cancellation timestamp
      await tx.booking.update({
        where: { id: req.params.id as string },
        data: {
          status: "CANCELLED",
          refundAmount: refund.finalRefund,
          cancelledAt: new Date(),
        },
      });

      // Decrement capacity using centralized helper
      await decrementCapacity(tx, booking);

      // Restore promo code usage if one was applied
      if (booking.promoCodeId) {
        await tx.promoCode.update({
          where: { id: booking.promoCodeId },
          data: { usageCount: { decrement: 1 } },
        });
      }

      return refund;
    });

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      data: {
        refundAmount: result.finalRefund,
        refundPercentage: result.refundPercentage,
        serviceFee: result.serviceFee,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error cancelling booking:", err);

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

    if (err.message?.startsWith("INVALID_STATUS:")) {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATUS",
        message: err.message.split(":")[1],
      });
    }

    if (err.message?.startsWith("PAST_EVENT:")) {
      return res.status(400).json({
        success: false,
        error: "PAST_EVENT",
        message: err.message.split(":")[1],
      });
    }

    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to cancel booking",
    });
  }
});

// GET /api/bookings/:id/qr - Get QR code image
router.get("/:id/qr", authenticate, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id as string },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Booking not found",
      });
    }

    if (booking.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "You can only view your own tickets",
      });
    }

    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATUS",
        message: "QR code is not available for this booking",
      });
    }

    const qrCodeImage = await generateQRCodeDataURL(booking.qrCodeData);

    res.json({
      success: true,
      data: {
        qrCode: qrCodeImage,
        ticketCode: booking.ticketCode,
      },
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to generate QR code",
    });
  }
});

export default router;
