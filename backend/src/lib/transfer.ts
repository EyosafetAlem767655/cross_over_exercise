import { generateTicketCode, generateQRData } from "./qr.js";

/**
 * Transfers a booking from one user to another by cancelling the original
 * booking and creating a fresh one for the recipient.
 *
 * This was built for the organizer reassignment flow where a clean audit
 * trail matters — the cancelled booking is preserved with timestamp, and
 * fresh ticket credentials are issued. The capacity decrement+increment
 * dance keeps counters consistent with the cancellation accounting.
 *
 * NOTE: This cancel+create approach has trade-offs. It generates a new
 * booking ID and ticket code, which breaks any external references to the
 * original booking. For flows where the recipient simply takes over an
 * existing ticket (no new credentials needed), a direct userId update on
 * the booking record would be simpler and preserve booking continuity.
 * Evaluate which trade-off fits your use case.
 *
 * @param tx - Prisma transaction client (call within $transaction)
 * @param bookingId - ID of the booking to transfer
 * @param recipientId - User ID of the new owner
 * @returns The newly created booking for the recipient
 */
export async function transferBooking(
  tx: any,
  bookingId: string,
  recipientId: string
) {
  // 1. Fetch the original booking with related data
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      event: true,
      seatTier: true,
    },
  });

  if (!booking) {
    throw new Error("NOT_FOUND:Booking not found");
  }

  if (booking.status !== "CONFIRMED") {
    throw new Error("INVALID_STATUS:Only confirmed bookings can be transferred");
  }

  // 2. Cancel the original booking
  // No refund for transfers — this is an ownership change, not a financial reversal
  await tx.booking.update({
    where: { id: booking.id },
    data: {
      status: "CANCELLED",
      refundAmount: 0,
      cancelledAt: new Date(),
    },
  });

  // 3. Adjust capacity counters (decrement for cancel, re-increment for new booking)
  // This two-step approach ensures the capacity logic stays consistent with
  // the rest of the booking system — cancel always decrements, create always increments.
  await tx.event.update({
    where: { id: booking.eventId },
    data: { soldCount: { decrement: 1 } },
  });

  if (booking.seatTierId) {
    await tx.seatTier.update({
      where: { id: booking.seatTierId },
      data: { soldCount: { decrement: 1 } },
    });
  }

  // 4. Create new booking for recipient with fresh ticket credentials
  const ticketCode = generateTicketCode();
  const qrCodeData = generateQRData(ticketCode);

  // Re-increment capacity
  await tx.event.update({
    where: { id: booking.eventId },
    data: { soldCount: { increment: 1 } },
  });

  if (booking.seatTierId) {
    await tx.seatTier.update({
      where: { id: booking.seatTierId },
      data: { soldCount: { increment: 1 } },
    });
  }

  const newBooking = await tx.booking.create({
    data: {
      ticketCode,
      qrCodeData,
      userId: recipientId,
      eventId: booking.eventId,
      seatTierId: booking.seatTierId,
      promoCodeId: booking.promoCodeId,
      pricePaid: booking.pricePaid,
      discountAmount: booking.discountAmount,
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
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return newBooking;
}
