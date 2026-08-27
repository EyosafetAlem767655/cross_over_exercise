/**
 * Centralized capacity management — all booking/cancellation flows
 * MUST use these helpers to keep event and tier counts consistent.
 */

/**
 * Decrement capacity counts when a booking is cancelled or removed.
 * Handles both event-level and tier-level sold counts.
 */
export async function decrementCapacity(tx: any, booking: any) {
  if (booking.seatTierId) {
    await tx.event.update({
      where: { id: booking.eventId },
      data: { soldCount: { decrement: 1 } },
    });
    await tx.seatTier.update({
      where: { id: booking.seatTierId },
      data: { soldCount: { decrement: 1 } },
    });
  }
}

/**
 * Increment capacity counts when a new booking is created.
 * Handles both event-level and tier-level sold counts.
 */
export async function incrementCapacity(
  tx: any,
  eventId: string,
  seatTierId?: string | null
) {
  await tx.event.update({
    where: { id: eventId },
    data: { soldCount: { increment: 1 } },
  });
  if (seatTierId) {
    await tx.seatTier.update({
      where: { id: seatTierId },
      data: { soldCount: { increment: 1 } },
    });
  }
}
