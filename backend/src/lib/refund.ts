/**
 * Refund calculation engine — single source of truth.
 * Used by the refund preview endpoint and the cancel endpoint
 * to ensure the preview always matches the actual refund.
 */

const DEFAULT_SERVICE_FEE_PERCENT = 5;

export interface RefundBreakdown {
  pricePaid: number;
  daysUntilEvent: number;
  refundPercentage: number; // 0, 50, or 100
  serviceFee: number;
  refundBeforeFee: number;
  finalRefund: number;
  canCancel: boolean;
  message: string;
}

/**
 * Round a monetary amount to 2 decimal places.
 * All financial calculations must pass through this to avoid floating-point display issues.
 */
function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Calculate the number of days until an event from now.
 * Uses Math.ceil so that 6 days and 1 hour = 7 days (benefits the attendee).
 */
function calcDaysUntilEvent(eventDate: Date): number {
  const now = new Date();
  const diffMs = eventDate.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Determine the refund percentage based on days until the event and the event's refund policy.
 *
 * TIERED (default):
 *   - 7+ days: 100%
 *   - 3-6 days: 50%
 *   - <3 days: 0%
 *
 * FULL_REFUND: always 100% (minus service fee)
 * NO_REFUND: always 0%
 */
function getRefundPercentage(daysUntilEvent: number, refundPolicy: string): number {
  if (refundPolicy === "FULL_REFUND") return 100;
  if (refundPolicy === "NO_REFUND") return 0;

  // TIERED policy (default)
  if (daysUntilEvent >= 7) return 100;
  if (daysUntilEvent >= 3) return 50;
  return 0;
}

/**
 * Calculate the full refund breakdown for a booking.
 *
 * @param pricePaid         The amount the attendee actually paid (after any promo discount)
 * @param eventDate         The event's date
 * @param refundPolicy      The event's refund policy (FULL_REFUND, TIERED, NO_REFUND)
 * @param serviceFeePercent The event's service fee percentage (default 5%)
 *
 * Formula:
 *   serviceFee      = pricePaid * serviceFeePercent%
 *   refundBeforeFee = pricePaid * refundPercentage%
 *   finalRefund     = refundBeforeFee - serviceFee
 *
 * If the event has already passed, cancellation is blocked entirely.
 * If pricePaid is 0 (free ticket), refund is $0 with a clear message.
 */
export function calculateRefund(
  pricePaid: number,
  eventDate: Date,
  refundPolicy: string = "TIERED",
  serviceFeePercent: number = DEFAULT_SERVICE_FEE_PERCENT
): RefundBreakdown {
  const now = new Date();

  // Event has already passed — cancellation not allowed
  if (eventDate.getTime() <= now.getTime()) {
    return {
      pricePaid: roundMoney(pricePaid),
      daysUntilEvent: 0,
      refundPercentage: 0,
      serviceFee: 0,
      refundBeforeFee: 0,
      finalRefund: 0,
      canCancel: false,
      message: "This event has already passed. Cancellation is not allowed.",
    };
  }

  const daysUntilEvent = calcDaysUntilEvent(eventDate);
  const refundPercentage = getRefundPercentage(daysUntilEvent, refundPolicy);

  // $0 ticket — nothing to refund
  if (pricePaid <= 0) {
    return {
      pricePaid: 0,
      daysUntilEvent,
      refundPercentage,
      serviceFee: 0,
      refundBeforeFee: 0,
      finalRefund: 0,
      canCancel: true,
      message: "No payment was made for this ticket. You may cancel with no refund.",
    };
  }

  const serviceFee = roundMoney(pricePaid * (serviceFeePercent / 100));
  const refundBeforeFee = roundMoney(pricePaid * (refundPercentage / 100));
  const finalRefund = roundMoney(Math.max(refundBeforeFee - serviceFee, 0));

  if (refundPercentage === 0) {
    return {
      pricePaid: roundMoney(pricePaid),
      daysUntilEvent,
      refundPercentage,
      serviceFee: 0,
      refundBeforeFee: 0,
      finalRefund: 0,
      canCancel: true,
      message:
        refundPolicy === "NO_REFUND"
          ? "This event has a no-refund policy. No refund will be issued."
          : "Less than 3 days before the event. No refund will be issued.",
    };
  }

  return {
    pricePaid: roundMoney(pricePaid),
    daysUntilEvent,
    refundPercentage,
    serviceFee,
    refundBeforeFee,
    finalRefund,
    canCancel: true,
    message:
      refundPercentage === 100
        ? `Full refund minus ${serviceFeePercent}% platform service fee.`
        : `Partial refund (${refundPercentage}%) minus ${serviceFeePercent}% platform service fee.`,
  };
}
