"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { eventsAPI } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export default function NewEventPage() {
  const router = useRouter();
  const { token } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    date: "",
    time: "",
    venue: "",
    imageUrl: "",
    artistInfo: "",
    price: "",
    capacity: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError("");
    setIsLoading(true);

    try {
      await eventsAPI.create(token, {
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
      router.push("/dashboard/events");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Create New Event</h1>

      <Card>
        <CardHeader>
          <p className="text-gray-600">Fill in the details for your new event. It will be saved as a draft.</p>
        </CardHeader>
        <CardContent>
          {error && <Alert variant="error" className="mb-4">{error}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Event Name" name="name" value={formData.name} onChange={handleChange} placeholder="Summer Rock Festival" required />
            <Textarea label="Description" name="description" value={formData.description} onChange={handleChange} placeholder="Describe your event..." required />

            <div className="grid grid-cols-2 gap-4">
              <Input label="Date" name="date" type="date" value={formData.date} onChange={handleChange} required />
              <Input label="Time" name="time" type="time" value={formData.time} onChange={handleChange} required />
            </div>

            <Input label="Venue" name="venue" value={formData.venue} onChange={handleChange} placeholder="Central Park, New York" required />
            <Input label="Image URL (optional)" name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://example.com/image.jpg" />
            <Input label="Artist/Speaker Info (optional)" name="artistInfo" value={formData.artistInfo} onChange={handleChange} placeholder="Featured performers or speakers" />

            <div className="grid grid-cols-2 gap-4">
              <Input label="Ticket Price ($)" name="price" type="number" min="0" step="0.01" value={formData.price} onChange={handleChange} placeholder="99.99" required />
              <Input label="Capacity" name="capacity" type="number" min="1" value={formData.capacity} onChange={handleChange} placeholder="500" required />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" isLoading={isLoading}>Create Event</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
