const API_URL = ""; // Relative path — Next.js rewrites proxy /api/* to backend

interface FetchOptions extends RequestInit {
  token?: string | null;
}

async function fetchAPI<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

// Auth API
export const authAPI = {
  register: (data: { email: string; password: string; name: string }) =>
    fetchAPI<{ success: boolean; data: { user: import("@/types").User; token: string } }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    fetchAPI<{ success: boolean; data: { user: import("@/types").User; token: string } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: (token: string) =>
    fetchAPI<{ success: boolean; data: import("@/types").User }>("/api/auth/me", { token }),

  updateProfile: (token: string, data: { name?: string }) =>
    fetchAPI<{ success: boolean; data: import("@/types").User }>("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
      token,
    }),
};

// Events API
export const eventsAPI = {
  list: (category?: string) =>
    fetchAPI<{ success: boolean; data: import("@/types").Event[] }>(
      `/api/events${category ? `?category=${category}` : ""}`
    ),

  listAll: (token: string) =>
    fetchAPI<{ success: boolean; data: import("@/types").Event[] }>("/api/events/all", { token }),

  get: (id: string) =>
    fetchAPI<{ success: boolean; data: import("@/types").Event }>(`/api/events/${id}`),

  create: (token: string, data: Partial<import("@/types").Event>) =>
    fetchAPI<{ success: boolean; data: import("@/types").Event }>("/api/events", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  update: (token: string, id: string, data: Partial<import("@/types").Event>) =>
    fetchAPI<{ success: boolean; data: import("@/types").Event }>(`/api/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      token,
    }),

  delete: (token: string, id: string) =>
    fetchAPI<{ success: boolean; data?: { totalBookingsCancelled: number; totalRefundAmount: number } }>(
      `/api/events/${id}`,
      { method: "DELETE", token }
    ),

  getAttendees: (token: string, id: string) =>
    fetchAPI<{ success: boolean; data: import("@/types").Attendee[] }>(`/api/events/${id}/attendees`, { token }),
};

// Tiers API
export const tiersAPI = {
  list: (eventId: string) =>
    fetchAPI<{ success: boolean; data: import("@/types").SeatTier[] }>(`/api/events/${eventId}/tiers`),

  create: (token: string, eventId: string, data: { name: string; price: number; capacity: number }) =>
    fetchAPI<{ success: boolean; data: import("@/types").SeatTier }>(`/api/events/${eventId}/tiers`, {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  update: (token: string, eventId: string, tierId: string, data: Partial<{ name: string; price: number; capacity: number }>) =>
    fetchAPI<{ success: boolean; data: import("@/types").SeatTier }>(`/api/events/${eventId}/tiers/${tierId}`, {
      method: "PUT",
      body: JSON.stringify(data),
      token,
    }),

  delete: (token: string, eventId: string, tierId: string) =>
    fetchAPI<{ success: boolean }>(`/api/events/${eventId}/tiers/${tierId}`, { method: "DELETE", token }),
};

// Promo Codes API
export const promoCodesAPI = {
  list: (token: string, eventId: string) =>
    fetchAPI<{ success: boolean; data: import("@/types").PromoCode[] }>(`/api/events/${eventId}/promo-codes`, { token }),

  create: (
    token: string,
    eventId: string,
    data: {
      code: string;
      discountType: string;
      discountValue: number;
      usageLimit?: number;
      validFrom?: string | null;
      validUntil?: string | null;
      minPurchaseAmount?: number | null;
      maxDiscountAmount?: number | null;
    }
  ) =>
    fetchAPI<{ success: boolean; data: import("@/types").PromoCode }>(`/api/events/${eventId}/promo-codes`, {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  validate: (token: string, eventId: string, code: string) =>
    fetchAPI<{
      success: boolean;
      data: {
        id: string;
        code: string;
        discountType: string;
        discountValue: number;
        minPurchaseAmount: number | null;
        maxDiscountAmount: number | null;
      };
    }>(`/api/events/${eventId}/promo-codes/validate`, {
      method: "POST",
      body: JSON.stringify({ code }),
      token,
    }),

  delete: (token: string, eventId: string, codeId: string) =>
    fetchAPI<{ success: boolean }>(`/api/events/${eventId}/promo-codes/${codeId}`, { method: "DELETE", token }),
};

// Bookings API
export const bookingsAPI = {
  list: (token: string) =>
    fetchAPI<{ success: boolean; data: import("@/types").Booking[] }>("/api/bookings", { token }),

  get: (token: string, id: string) =>
    fetchAPI<{ success: boolean; data: import("@/types").Booking }>(`/api/bookings/${id}`, { token }),

  create: (token: string, data: { eventId: string; seatTierId?: string; promoCode?: string }) =>
    fetchAPI<{ success: boolean; data: import("@/types").Booking }>("/api/bookings", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  cancel: (token: string, id: string) =>
    fetchAPI<{
      success: boolean;
      message: string;
      data: { refundAmount: number; refundPercentage: number; serviceFee: number };
    }>(`/api/bookings/${id}`, { method: "DELETE", token }),

  getRefundPreview: (token: string, id: string) =>
    fetchAPI<{ success: boolean; data: import("@/types").RefundBreakdown }>(`/api/bookings/${id}/refund-preview`, {
      token,
    }),

  getQR: (token: string, id: string) =>
    fetchAPI<{ success: boolean; data: { qrCode: string; ticketCode: string } }>(`/api/bookings/${id}/qr`, { token }),
};

// Dashboard API
export const dashboardAPI = {
  getStats: (token: string) =>
    fetchAPI<{ success: boolean; data: import("@/types").DashboardStats }>("/api/dashboard/stats", { token }),

  getEventStats: (token: string, id: string) =>
    fetchAPI<{ success: boolean; data: import("@/types").EventStats }>(`/api/dashboard/events/${id}/stats`, { token }),

  getVelocity: (token: string) =>
    fetchAPI<{ success: boolean; data: { hour: string; count: number; revenue: number }[] }>("/api/dashboard/velocity", {
      token,
    }),
};
