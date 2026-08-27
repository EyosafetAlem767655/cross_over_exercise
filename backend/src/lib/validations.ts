import { z } from "zod";

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
});

// Event schemas
export const createEventSchema = z.object({
  name: z.string().min(3, "Event name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  venue: z.string().min(3, "Venue must be at least 3 characters"),
  imageUrl: z.string().url("Invalid image URL").optional().or(z.literal("")),
  artistInfo: z.string().optional(),
  category: z.enum(["MUSIC", "SPORTS", "CONFERENCE", "WORKSHOP", "COMEDY", "OTHER"]).optional(),
  price: z.number().min(0, "Price cannot be negative"),
  capacity: z.number().int().min(1, "Capacity must be at least 1"),
  refundPolicy: z.enum(["FULL_REFUND", "TIERED", "NO_REFUND"]).optional(),
  serviceFeePercent: z.number().min(0).max(100).optional(),
});

export const updateEventSchema = createEventSchema.partial().extend({
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]).optional(),
});

// Tier schemas
export const createTierSchema = z.object({
  name: z.string().min(1, "Tier name is required"),
  price: z.number().min(0, "Price cannot be negative"),
  capacity: z.number().int().min(1, "Capacity must be at least 1"),
});

export const updateTierSchema = createTierSchema.partial();

// Promo Code schemas
export const createPromoCodeSchema = z.object({
  code: z.string().min(1, "Code is required").max(20, "Code must be 20 characters or less"),
  discountType: z.enum(["PERCENTAGE", "FIXED"], { errorMap: () => ({ message: "Discount type must be PERCENTAGE or FIXED" }) }),
  discountValue: z.number().positive("Discount value must be positive"),
  usageLimit: z.number().int().positive("Usage limit must be positive").optional(),
  validFrom: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date").optional().nullable(),
  validUntil: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date").optional().nullable(),
  minPurchaseAmount: z.number().min(0).optional().nullable(),
  maxDiscountAmount: z.number().min(0).optional().nullable(),
});

export const BOOKING_STATUSES = ["CONFIRMED", "CANCELLED", "CHECKED_IN", "WAITLISTED"] as const;

// Booking schemas
export const createBookingSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  seatTierId: z.string().min(1, "Seat tier is required").optional(),
  promoCode: z.string().optional(),
});

// Reassignment schema (organizer)
export const reassignBookingSchema = z.object({
  recipientEmail: z.string().email("Invalid email address"),
});

// Check-in schema
export const checkinSchema = z.object({
  qrCode: z.string().min(1, "QR code data is required"),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateTierInput = z.infer<typeof createTierSchema>;
export type UpdateTierInput = z.infer<typeof updateTierSchema>;
export type CreatePromoCodeInput = z.infer<typeof createPromoCodeSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type ReassignBookingInput = z.infer<typeof reassignBookingSchema>;
export type CheckinInput = z.infer<typeof checkinSchema>;
