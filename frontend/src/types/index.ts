export type UserRole = "ORGANIZER" | "ATTENDEE";
export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
export type BookingStatus = "CONFIRMED" | "CANCELLED" | "CHECKED_IN" | "WAITLISTED";
export type EventCategory = "MUSIC" | "SPORTS" | "CONFERENCE" | "WORKSHOP" | "COMEDY" | "OTHER";
export type RefundPolicy = "FULL_REFUND" | "TIERED" | "NO_REFUND";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isVerified?: boolean;
  verifiedAt?: string | null;
  createdAt?: string;
}

export interface SeatTier {
  id: string;
  name: string;
  price: number;
  capacity: number;
  soldCount: number;
  eventId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  minPurchaseAmount: number | null;
  maxDiscountAmount: number | null;
  eventId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  imageUrl: string | null;
  artistInfo: string | null;
  category: EventCategory;
  price: number;
  capacity: number;
  soldCount: number;
  status: EventStatus;
  refundPolicy: RefundPolicy;
  serviceFeePercent: number;
  organizerId: string;
  organizer?: { id: string; name: string };
  seatTiers?: SeatTier[];
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  ticketCode: string;
  qrCodeData: string;
  status: BookingStatus;
  pricePaid: number;
  discountAmount: number;
  refundAmount: number;
  cancelledAt: string | null;
  checkedInAt: string | null;
  userId: string;
  eventId: string;
  seatTierId: string | null;
  promoCodeId: string | null;
  event?: {
    id: string;
    name: string;
    date: string;
    time: string;
    venue: string;
    imageUrl: string | null;
    artistInfo?: string | null;
    status: EventStatus;
    category?: EventCategory;
    refundPolicy?: RefundPolicy;
    serviceFeePercent?: number;
  };
  seatTier?: {
    id: string;
    name: string;
    price: number;
  } | null;
  promoCode?: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefundBreakdown {
  pricePaid: number;
  daysUntilEvent: number;
  refundPercentage: number;
  serviceFee: number;
  refundBeforeFee: number;
  finalRefund: number;
  canCancel: boolean;
  message: string;
}

export interface TierBreakdown {
  tierId: string;
  tierName: string;
  tierPrice: number;
  capacity: number;
  soldCount: number;
  ticketsSold: number;
  revenue: number;
  remainingCapacity: number;
}

export interface PromoCodeStat {
  codeId: string;
  code: string;
  discountType: string;
  discountValue: number;
  usageCount: number;
  usageLimit: number | null;
  isActive: boolean;
  totalDiscountGiven: number;
}

export interface DashboardStats {
  totalEvents: number;
  totalTicketsSold: number;
  grossRevenue: number;
  netRevenue: number;
  totalRevenue: number;
  totalRefunds: number;
  totalRefundCount: number;
  totalCheckedIn: number;
  attendanceRate: number;
  categoryBreakdown: Record<string, { events: number; tickets: number; revenue: number }>;
  recentSales: { date: string; count: number; revenue: number }[];
}

export interface EventStats {
  ticketsSold: number;
  revenue: number;
  totalDiscounts: number;
  totalRefunds: number;
  totalRefundCount: number;
  checkedIn: number;
  attendanceRate: number;
  remainingCapacity: number;
  capacity: number;
  salesVelocity: { hour: string; count: number }[];
  tierBreakdown?: TierBreakdown[];
  promoCodeStats?: PromoCodeStat[];
}

export interface Attendee {
  bookingId: string;
  ticketCode: string;
  status: BookingStatus;
  pricePaid?: number;
  seatTier?: { id: string; name: string } | null;
  checkedInAt: string | null;
  bookedAt: string;
  user: { id: string; name: string; email: string };
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthData {
  user: User;
  token: string;
}
