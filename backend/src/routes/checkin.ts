import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { checkinSchema } from "../lib/validations.js";
import { authenticateApiKey } from "../middleware/auth.js";
import { parseQRData } from "../lib/qr.js";

const router = Router();

// POST /api/checkin - Validate and check-in ticket
router.post("/", authenticateApiKey, async (req, res) => {
  try {
    const result = checkinSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: result.error.errors[0].message,
      });
    }

    const { qrCode } = result.data;

    // Parse QR data
    const qrData = parseQRData(qrCode);
    if (!qrData) {
      return res.status(400).json({
        success: false,
        error: "INVALID_QR",
        message: "Invalid QR code format",
      });
    }

    // Find booking by QR data
    const booking = await prisma.booking.findFirst({
      where: {
        qrCodeData: qrCode,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
        event: {
          select: {
            name: true,
            status: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "INVALID_TICKET",
        message: "Ticket not found",
      });
    }

    // Check if event is cancelled
    if (booking.event.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        error: "EVENT_CANCELLED",
        message: "This event has been cancelled",
      });
    }

    // Check if booking is cancelled
    if (booking.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        error: "TICKET_CANCELLED",
        message: "This ticket has been cancelled",
      });
    }

    // Check if already checked in
    if (booking.status === "CHECKED_IN") {
      return res.status(409).json({
        success: false,
        error: "ALREADY_CHECKED_IN",
        message: `Ticket already used at ${booking.checkedInAt?.toISOString()}`,
        data: {
          checkedInAt: booking.checkedInAt,
          attendeeName: booking.user.name,
        },
      });
    }

    // Mark as checked in
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "CHECKED_IN",
        checkedInAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: "Check-in successful",
      data: {
        attendee: {
          name: booking.user.name,
          ticketCode: booking.ticketCode,
        },
        event: {
          name: booking.event.name,
        },
      },
    });
  } catch (error) {
    console.error("Error checking in:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to check in",
    });
  }
});

export default router;
