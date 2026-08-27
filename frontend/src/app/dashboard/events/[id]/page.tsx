"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Event, Attendee, SeatTier, PromoCode, EventStats } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { eventsAPI, tiersAPI, promoCodesAPI, dashboardAPI } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";

export default function EditEventPage() {
  const params = useParams();
  const { token } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [tiers, setTiers] = useState<SeatTier[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [formData, setFormData] = useState({
    name: "", description: "", date: "", time: "", venue: "", imageUrl: "", artistInfo: "", price: "", capacity: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Tier form
  const [tierForm, setTierForm] = useState({ name: "", price: "", capacity: "" });
  const [tierError, setTierError] = useState("");
  const [isAddingTier, setIsAddingTier] = useState(false);

  // Promo form
  const [promoForm, setPromoForm] = useState({ code: "", discountType: "PERCENTAGE", discountValue: "", usageLimit: "" });
  const [promoError, setPromoError] = useState("");
  const [isAddingPromo, setIsAddingPromo] = useState(false);

  useEffect(() => {
    if (!token) return;

    Promise.all([
      eventsAPI.get(params.id as string),
      eventsAPI.getAttendees(token, params.id as string),
      tiersAPI.list(params.id as string),
      promoCodesAPI.list(token, params.id as string),
      dashboardAPI.getEventStats(token, params.id as string),
    ])
      .then(([eventRes, attendeesRes, tiersRes, promosRes, statsRes]) => {
        const e = eventRes.data;
        setEvent(e);
        setAttendees(attendeesRes.data);
        setTiers(tiersRes.data);
        setPromoCodes(promosRes.data);
        setEventStats(statsRes.data);
        setFormData({
          name: e.name,
          description: e.description,
          date: e.date.split("T")[0],
          time: e.time,
          venue: e.venue,
          imageUrl: e.imageUrl || "",
          artistInfo: e.artistInfo || "",
          price: e.price.toString(),
          capacity: e.capacity.toString(),
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [token, params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const updated = await eventsAPI.update(token, params.id as string, {
        name: formData.name,
        description: formData.description,
        date: formData.date,
        time: formData.time,
        venue: formData.venue,
        imageUrl: formData.imageUrl || undefined,
        artistInfo: formData.artistInfo || undefined,
        price: parseFloat(formData.price),
        capacity: parseInt(formData.capacity),
      });
      setEvent(updated.data);
      setSuccess("Event updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddTier = async () => {
    if (!token) return;
    setTierError("");
    setIsAddingTier(true);

    try {
      const res = await tiersAPI.create(token, params.id as string, {
        name: tierForm.name,
        price: parseFloat(tierForm.price),
        capacity: parseInt(tierForm.capacity),
      });
      setTiers([...tiers, res.data]);
      setTierForm({ name: "", price: "", capacity: "" });
    } catch (err) {
      setTierError(err instanceof Error ? err.message : "Failed to create tier");
    } finally {
      setIsAddingTier(false);
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    if (!token) return;
    try {
      await tiersAPI.delete(token, params.id as string, tierId);
      setTiers(tiers.filter((t) => t.id !== tierId));
    } catch (err) {
      setTierError(err instanceof Error ? err.message : "Failed to delete tier");
    }
  };

  const handleAddPromo = async () => {
    if (!token) return;
    setPromoError("");
    setIsAddingPromo(true);

    try {
      const res = await promoCodesAPI.create(token, params.id as string, {
        code: promoForm.code,
        discountType: promoForm.discountType,
        discountValue: parseFloat(promoForm.discountValue),
        usageLimit: promoForm.usageLimit ? parseInt(promoForm.usageLimit) : undefined,
      });
      setPromoCodes([res.data, ...promoCodes]);
      setPromoForm({ code: "", discountType: "PERCENTAGE", discountValue: "", usageLimit: "" });
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "Failed to create promo code");
    } finally {
      setIsAddingPromo(false);
    }
  };

  const handleDeactivatePromo = async (codeId: string) => {
    if (!token) return;
    try {
      await promoCodesAPI.delete(token, params.id as string, codeId);
      setPromoCodes(promoCodes.map((p) => (p.id === codeId ? { ...p, isActive: false } : p)));
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "Failed to deactivate promo code");
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Spinner size="lg" /></div>;
  }

  if (!event) {
    return <Alert variant="error">Event not found</Alert>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Edit Event</h1>
        <Link href="/dashboard/events"><Button variant="secondary">Back to Events</Button></Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">Event Details</h2></CardHeader>
            <CardContent>
              {error && <Alert variant="error" className="mb-4">{error}</Alert>}
              {success && <Alert variant="success" className="mb-4">{success}</Alert>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Event Name" name="name" value={formData.name} onChange={handleChange} required />
                <Textarea label="Description" name="description" value={formData.description} onChange={handleChange} required />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Date" name="date" type="date" value={formData.date} onChange={handleChange} required />
                  <Input label="Time" name="time" type="time" value={formData.time} onChange={handleChange} required />
                </div>
                <Input label="Venue" name="venue" value={formData.venue} onChange={handleChange} required />
                <Input label="Image URL" name="imageUrl" value={formData.imageUrl} onChange={handleChange} />
                <Input label="Artist/Speaker Info" name="artistInfo" value={formData.artistInfo} onChange={handleChange} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Base Price ($)" name="price" type="number" min="0" step="0.01" value={formData.price} onChange={handleChange} required />
                  <Input label="Capacity" name="capacity" type="number" min="1" value={formData.capacity} onChange={handleChange} required />
                </div>
                <Button type="submit" isLoading={isSaving}>Save Changes</Button>
              </form>
            </CardContent>
          </Card>

          {/* Seat Tiers Section */}
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">Seat Tiers ({tiers.length}/4)</h2></CardHeader>
            <CardContent>
              {tierError && <Alert variant="error" className="mb-4">{tierError}</Alert>}

              {tiers.length > 0 && (
                <div className="space-y-3 mb-4">
                  {tiers.map((tier) => (
                    <div key={tier.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{tier.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatCurrency(tier.price)} · {tier.soldCount}/{tier.capacity} sold
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {tier.soldCount >= tier.capacity && <Badge variant="danger">Sold Out</Badge>}
                        {tier.soldCount === 0 && (
                          <Button size="sm" variant="danger" onClick={() => handleDeleteTier(tier.id)}>Delete</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tiers.length < 4 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Add New Tier</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Input placeholder="Name" value={tierForm.name} onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })} />
                    <Input placeholder="Price" type="number" min="0" step="0.01" value={tierForm.price} onChange={(e) => setTierForm({ ...tierForm, price: e.target.value })} />
                    <Input placeholder="Capacity" type="number" min="1" value={tierForm.capacity} onChange={(e) => setTierForm({ ...tierForm, capacity: e.target.value })} />
                  </div>
                  <Button size="sm" className="mt-3" onClick={handleAddTier} isLoading={isAddingTier}
                    disabled={!tierForm.name || !tierForm.price || !tierForm.capacity}>
                    Add Tier
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Promo Codes Section */}
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">Promo Codes</h2></CardHeader>
            <CardContent>
              {promoError && <Alert variant="error" className="mb-4">{promoError}</Alert>}

              {promoCodes.length > 0 && (
                <div className="space-y-3 mb-4">
                  {promoCodes.map((promo) => (
                    <div key={promo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-medium">{promo.code}</p>
                          <Badge variant={promo.isActive ? "success" : "danger"}>
                            {promo.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          {promo.discountType === "PERCENTAGE" ? `${promo.discountValue}% off` : `${formatCurrency(promo.discountValue)} off`}
                          {promo.usageLimit && ` · ${promo.usageCount}/${promo.usageLimit} used`}
                          {!promo.usageLimit && ` · ${promo.usageCount} used`}
                        </p>
                      </div>
                      {promo.isActive && (
                        <Button size="sm" variant="danger" onClick={() => handleDeactivatePromo(promo.id)}>Deactivate</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Add New Promo Code</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Code (e.g., SAVE20)" value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value })} />
                  <select
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={promoForm.discountType}
                    onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value })}
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed ($)</option>
                  </select>
                  <Input placeholder="Discount Value" type="number" min="0" step="0.01" value={promoForm.discountValue} onChange={(e) => setPromoForm({ ...promoForm, discountValue: e.target.value })} />
                  <Input placeholder="Usage Limit (optional)" type="number" min="1" value={promoForm.usageLimit} onChange={(e) => setPromoForm({ ...promoForm, usageLimit: e.target.value })} />
                </div>
                <Button size="sm" className="mt-3" onClick={handleAddPromo} isLoading={isAddingPromo}
                  disabled={!promoForm.code || !promoForm.discountValue}>
                  Add Promo Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">Event Stats</h2></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-500">Status</span><Badge variant={event.status === "PUBLISHED" ? "success" : event.status === "CANCELLED" ? "danger" : "warning"}>{event.status}</Badge></div>
              <div className="flex justify-between"><span className="text-gray-500">Tickets Sold</span><span className="font-medium">{event.soldCount} / {event.capacity}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Revenue</span><span className="font-medium">{formatCurrency(event.soldCount * event.price)}</span></div>
            </CardContent>
          </Card>

          {/* Tier Breakdown */}
          {eventStats?.tierBreakdown && eventStats.tierBreakdown.length > 0 && (
            <Card>
              <CardHeader><h2 className="text-lg font-semibold">Tier Breakdown</h2></CardHeader>
              <CardContent className="space-y-3">
                {eventStats.tierBreakdown.map((tb) => (
                  <div key={tb.tierId} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{tb.tierName}</span>
                      <span className="text-sm text-gray-500">{formatCurrency(tb.tierPrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mt-1">
                      <span>{tb.ticketsSold}/{tb.capacity} sold</span>
                      <span>{formatCurrency(tb.revenue)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-sky-500 h-2 rounded-full"
                        style={{ width: `${Math.min((tb.soldCount / tb.capacity) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><h2 className="text-lg font-semibold">Attendees ({attendees.length})</h2></CardHeader>
            <CardContent>
              {attendees.length === 0 ? (
                <p className="text-gray-500 text-sm">No attendees yet</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {attendees.map((a) => (
                    <div key={a.bookingId} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{a.user.name}</p>
                        <p className="text-xs text-gray-500">{a.user.email}</p>
                      </div>
                      <Badge variant={a.status === "CHECKED_IN" ? "success" : "info"} className="text-xs">
                        {a.status === "CHECKED_IN" ? "Checked In" : "Confirmed"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
