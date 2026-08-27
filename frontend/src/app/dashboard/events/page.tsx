"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Event } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { eventsAPI } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";

export default function EventsManagementPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!token) return;
    eventsAPI
      .listAll(token)
      .then((res) => setEvents(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleCancel = async () => {
    if (!token || !cancelId) return;
    setIsCancelling(true);

    try {
      await eventsAPI.delete(token, cancelId);
      setEvents(events.map((e) => (e.id === cancelId ? { ...e, status: "CANCELLED" } : e)));
      setCancelId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePublish = async (id: string) => {
    if (!token) return;
    try {
      await eventsAPI.update(token, id, { status: "PUBLISHED" });
      setEvents(events.map((e) => (e.id === id ? { ...e, status: "PUBLISHED" } : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Spinner size="lg" /></div>;
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "DRAFT": return <Badge variant="warning">Draft</Badge>;
      case "PUBLISHED": return <Badge variant="success">Published</Badge>;
      case "CANCELLED": return <Badge variant="danger">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Events</h1>
        <Link href="/dashboard/events/new"><Button>Create Event</Button></Link>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {events.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No events yet. Create your first event!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id}>
              <CardContent className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                  {event.imageUrl ? (
                    <img src={event.imageUrl} alt={event.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{event.name}</h3>
                    {statusBadge(event.status)}
                  </div>
                  <p className="text-sm text-gray-600">{formatDate(event.date)} | {event.venue}</p>
                  <p className="text-sm text-gray-500">{formatCurrency(event.price)} | {event.soldCount}/{event.capacity} sold</p>
                </div>

                <div className="flex gap-2">
                  {event.status === "DRAFT" && (
                    <Button size="sm" onClick={() => handlePublish(event.id)}>Publish</Button>
                  )}
                  {event.status !== "CANCELLED" && (
                    <>
                      <Link href={`/dashboard/events/${event.id}`}>
                        <Button size="sm" variant="secondary">Edit</Button>
                      </Link>
                      <Button size="sm" variant="danger" onClick={() => setCancelId(event.id)}>Cancel</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={!!cancelId} onClose={() => setCancelId(null)} title="Cancel Event">
        <div className="space-y-4">
          <p className="text-gray-600">Are you sure you want to cancel this event? All tickets will be invalidated.</p>
          <div className="flex space-x-3">
            <Button variant="secondary" className="flex-1" onClick={() => setCancelId(null)} disabled={isCancelling}>Keep Event</Button>
            <Button variant="danger" className="flex-1" onClick={handleCancel} isLoading={isCancelling}>Cancel Event</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
