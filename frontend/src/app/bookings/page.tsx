"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Booking, RefundBreakdown } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { bookingsAPI } from "@/lib/api";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";

export default function BookingsPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [refundPreview, setRefundPreview] = useState<RefundBreakdown | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      router.push("/login?callbackUrl=/bookings");
      return;
    }

    bookingsAPI
      .list(token)
      .then((res) => setBookings(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [user, token, authLoading, router]);

  // Fetch refund preview when cancel modal opens
  useEffect(() => {
    if (!cancelId || !token) {
      setRefundPreview(null);
      return;
    }
    setIsLoadingPreview(true);
    bookingsAPI
      .getRefundPreview(token, cancelId)
      .then((res) => setRefundPreview(res.data))
      .catch(() => setRefundPreview(null))
      .finally(() => setIsLoadingPreview(false));
  }, [cancelId, token]);

  const handleCancel = async () => {
    if (!token || !cancelId) return;
    setIsCancelling(true);

    try {
      const res = await bookingsAPI.cancel(token, cancelId);
      setBookings(bookings.map((b) => (b.id === cancelId ? { ...b, status: "CANCELLED" } : b)));
      setCancelSuccess(
        res.data.refundAmount > 0
          ? `Booking cancelled. Refund of ${formatCurrency(res.data.refundAmount)} will be processed.`
          : "Booking cancelled successfully."
      );
      setCancelId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setIsCancelling(false);
    }
  };

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Spinner size="lg" /></div>;
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED": return <Badge variant="success">Confirmed</Badge>;
      case "CHECKED_IN": return <Badge variant="info">Checked In</Badge>;
      case "CANCELLED": return <Badge variant="danger">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">My Bookings</h1>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {cancelSuccess && <Alert variant="success" className="mb-4">{cancelSuccess}</Alert>}

      {bookings.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No bookings yet</h3>
          <p className="mt-2 text-gray-500">Browse events and book your first ticket!</p>
          <Link href="/"><Button className="mt-4">Browse Events</Button></Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardContent className="flex items-center gap-4">
                <div className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                  {booking.event?.imageUrl ? (
                    <img src={booking.event.imageUrl} alt={booking.event.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{booking.event?.name}</h3>
                    {statusBadge(booking.status)}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {booking.event && formatDate(booking.event.date)} at {booking.event && formatTime(booking.event.time)}
                  </p>
                  <p className="text-sm text-gray-500">{booking.event?.venue}</p>
                  {booking.seatTier && (
                    <p className="text-sm text-sky-600 font-medium">{booking.seatTier.name} — {formatCurrency(booking.pricePaid)}</p>
                  )}
                  {!booking.seatTier && booking.pricePaid > 0 && (
                    <p className="text-sm text-sky-600 font-medium">{formatCurrency(booking.pricePaid)}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Ticket: {booking.ticketCode.slice(0, 8).toUpperCase()}</p>
                </div>

                <div className="flex flex-col gap-2">
                  {booking.status === "CONFIRMED" && (
                    <>
                      <Link href={`/tickets/${booking.id}`}>
                        <Button size="sm">View Ticket</Button>
                      </Link>
                      <Button size="sm" variant="danger" onClick={() => { setCancelId(booking.id); setCancelSuccess(""); }}>Cancel</Button>
                    </>
                  )}
                  {booking.status === "CANCELLED" && booking.refundAmount > 0 && (
                    <span className="text-xs text-gray-500">Refund: {formatCurrency(booking.refundAmount)}</span>
                  )}
                  {booking.status === "CHECKED_IN" && (
                    <Badge variant="success" className="px-4 py-2">Attended</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={!!cancelId} onClose={() => setCancelId(null)} title="Cancel Booking">
        <div className="space-y-4">
          {isLoadingPreview ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : refundPreview ? (
            <>
              <p className="text-gray-600">{refundPreview.message}</p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Amount paid</span>
                  <span className="text-gray-900 font-medium">{formatCurrency(refundPreview.pricePaid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Refund ({refundPreview.refundPercentage}%)</span>
                  <span className="text-gray-900">{formatCurrency(refundPreview.refundBeforeFee)}</span>
                </div>
                {refundPreview.serviceFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Service fee</span>
                    <span className="text-red-600">-{formatCurrency(refundPreview.serviceFee)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Your refund</span>
                  <span className="text-green-600">{formatCurrency(refundPreview.finalRefund)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-600">Are you sure you want to cancel this booking? This action cannot be undone.</p>
          )}
          <div className="flex space-x-3">
            <Button variant="secondary" className="flex-1" onClick={() => setCancelId(null)} disabled={isCancelling}>Keep Booking</Button>
            <Button variant="danger" className="flex-1" onClick={handleCancel} isLoading={isCancelling}>Cancel Booking</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
