"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Event, SeatTier } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { eventsAPI, bookingsAPI, promoCodesAPI } from "@/lib/api";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";

export default function EventPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [selectedTier, setSelectedTier] = useState<SeatTier | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState<{ type: string; value: number } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  useEffect(() => {
    eventsAPI
      .get(params.id as string)
      .then((res) => setEvent(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [params.id]);

  const handlePurchase = () => {
    if (!user) {
      router.push(`/login?callbackUrl=/events/${params.id}`);
      return;
    }
    if (event?.seatTiers && event.seatTiers.length > 0 && !selectedTier) {
      setPurchaseError("Please select a seat tier");
      return;
    }
    setShowModal(true);
  };

  const handleApplyPromo = async () => {
    if (!token || !promoCode.trim()) return;
    setIsValidatingPromo(true);
    setPromoError("");
    setPromoDiscount(null);

    try {
      const res = await promoCodesAPI.validate(token, params.id as string, promoCode.trim());
      setPromoDiscount({ type: res.data.discountType, value: res.data.discountValue });
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "Invalid promo code");
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const confirmPurchase = async () => {
    if (!token) return;
    setIsPurchasing(true);
    setPurchaseError("");

    try {
      const res = await bookingsAPI.create(token, {
        eventId: params.id as string,
        seatTierId: selectedTier?.id,
        promoCode: promoDiscount ? promoCode.trim() : undefined,
      });
      router.push(`/tickets/${res.data.id}`);
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Failed to purchase");
    } finally {
      setIsPurchasing(false);
    }
  };

  const getDisplayPrice = () => {
    const basePrice = selectedTier ? selectedTier.price : (event?.price || 0);
    if (!promoDiscount) return basePrice;
    if (promoDiscount.type === "PERCENTAGE") {
      return basePrice * (1 - promoDiscount.value / 100);
    }
    return basePrice - promoDiscount.value;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Spinner size="lg" /></div>;
  }

  if (error || !event) {
    return <div className="container py-8 text-center text-red-600">{error || "Event not found"}</div>;
  }

  const hasTiers = event.seatTiers && event.seatTiers.length > 0;
  const isCancelled = event.status === "CANCELLED";
  const isSoldOut = hasTiers
    ? event.seatTiers!.every((t) => t.soldCount >= t.capacity)
    : event.soldCount >= event.capacity;
  const isPastEvent = new Date(event.date) < new Date();
  const isDisabled = isSoldOut || isCancelled || isPastEvent;

  return (
    <div className="container py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden relative">
            {event.imageUrl ? (
              <img src={event.imageUrl} alt={event.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="h-20 w-20 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            {isCancelled && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Badge variant="danger" className="text-xl px-6 py-3">Event Cancelled</Badge>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
              {isSoldOut && !isCancelled && <Badge variant="danger">Sold Out</Badge>}
            </div>
            {event.artistInfo && <p className="text-lg text-gray-600 mt-1">{event.artistInfo}</p>}
          </div>

          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">About This Event</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
            </CardContent>
          </Card>

          {hasTiers && (
            <Card>
              <CardContent>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Your Tier</h2>
                <div className="space-y-3">
                  {event.seatTiers!.map((tier) => {
                    const tierSoldOut = tier.soldCount >= tier.capacity;
                    const remaining = tier.capacity - tier.soldCount;
                    const isSelected = selectedTier?.id === tier.id;

                    return (
                      <div
                        key={tier.id}
                        onClick={() => !tierSoldOut && !isDisabled && setSelectedTier(tier)}
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          tierSoldOut ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed" :
                          isSelected ? "border-sky-500 bg-sky-50" : "border-gray-200 hover:border-sky-300"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-semibold text-gray-900">{tier.name}</h3>
                            <p className="text-sm text-gray-500">
                              {tierSoldOut ? "Sold Out" : `${remaining} remaining`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-sky-600">{formatCurrency(tier.price)}</p>
                            {tierSoldOut && <Badge variant="danger" className="text-xs">Sold Out</Badge>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-8">
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <svg className="h-6 w-6 text-sky-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">{formatDate(event.date)}</p>
                  <p className="text-sm text-gray-600">{formatTime(event.time)}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <svg className="h-6 w-6 text-sky-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="font-medium text-gray-900">{event.venue}</p>
              </div>

              <hr className="border-gray-200" />

              <div className="text-center">
                {hasTiers ? (
                  selectedTier ? (
                    <>
                      <p className="text-sm text-gray-500">{selectedTier.name}</p>
                      {promoDiscount ? (
                        <div>
                          <p className="text-lg text-gray-400 line-through">{formatCurrency(selectedTier.price)}</p>
                          <p className="text-3xl font-bold text-green-600">{formatCurrency(getDisplayPrice())}</p>
                          <p className="text-sm text-green-600">
                            {promoDiscount.type === "PERCENTAGE" ? `${promoDiscount.value}% off` : `${formatCurrency(promoDiscount.value)} off`}
                          </p>
                        </div>
                      ) : (
                        <p className="text-3xl font-bold text-sky-600">{formatCurrency(selectedTier.price)}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-lg text-gray-500">Select a tier to see price</p>
                  )
                ) : (
                  <>
                    {promoDiscount ? (
                      <div>
                        <p className="text-lg text-gray-400 line-through">{formatCurrency(event.price)}</p>
                        <p className="text-3xl font-bold text-green-600">{formatCurrency(getDisplayPrice())}</p>
                        <p className="text-sm text-green-600">
                          {promoDiscount.type === "PERCENTAGE" ? `${promoDiscount.value}% off` : `${formatCurrency(promoDiscount.value)} off`}
                        </p>
                      </div>
                    ) : (
                      <p className="text-3xl font-bold text-sky-600">{formatCurrency(event.price)}</p>
                    )}
                    {!isSoldOut && !isCancelled && !isPastEvent && (
                      <p className="text-sm text-gray-500 mt-1">{event.capacity - event.soldCount} tickets remaining</p>
                    )}
                  </>
                )}
              </div>

              {user && !isDisabled && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Promo code"
                      value={promoCode}
                      onChange={(e) => { setPromoCode(e.target.value); setPromoError(""); setPromoDiscount(null); }}
                      className="flex-1"
                    />
                    <Button size="sm" variant="secondary" onClick={handleApplyPromo} isLoading={isValidatingPromo} disabled={!promoCode.trim()}>
                      Apply
                    </Button>
                  </div>
                  {promoError && <p className="text-sm text-red-600">{promoError}</p>}
                  {promoDiscount && <p className="text-sm text-green-600">Promo code applied!</p>}
                </div>
              )}

              {purchaseError && <Alert variant="error">{purchaseError}</Alert>}

              <Button className="w-full" size="lg" disabled={isDisabled} onClick={handlePurchase}>
                {isCancelled ? "Event Cancelled" : isSoldOut ? "Sold Out" : isPastEvent ? "Event Ended" : "Buy Ticket"}
              </Button>

              {isPastEvent && !isCancelled && <p className="text-center text-sm text-gray-500">This event has ended</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Confirm Purchase">
        <div className="space-y-4">
          {purchaseError && <Alert variant="error">{purchaseError}</Alert>}
          <div className="space-y-2">
            {selectedTier && (
              <div className="flex justify-between">
                <span className="text-gray-600">Tier</span>
                <span className="font-medium">{selectedTier.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Price</span>
              <span className="font-medium">{formatCurrency(selectedTier?.price || event.price)}</span>
            </div>
            {promoDiscount && (
              <>
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{promoDiscount.type === "PERCENTAGE" ? `${promoDiscount.value}%` : formatCurrency(promoDiscount.value)}</span>
                </div>
                <hr />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(getDisplayPrice())}</span>
                </div>
              </>
            )}
          </div>
          <p className="text-gray-600 text-sm">This is a mock payment - no actual charge will be made.</p>
          <div className="flex space-x-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)} disabled={isPurchasing}>Cancel</Button>
            <Button className="flex-1" onClick={confirmPurchase} isLoading={isPurchasing}>Confirm Purchase</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
