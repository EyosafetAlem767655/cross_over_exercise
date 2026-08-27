"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Event } from "@/types";
import { eventsAPI } from "@/lib/api";
import { formatDate, formatTime, formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

const CATEGORIES = [
  { value: "", label: "All Events" },
  { value: "MUSIC", label: "Music" },
  { value: "SPORTS", label: "Sports" },
  { value: "CONFERENCE", label: "Conference" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "COMEDY", label: "Comedy" },
  { value: "OTHER", label: "Other" },
];

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    setIsLoading(true);
    eventsAPI
      .list(selectedCategory || undefined)
      .then((res) => setEvents(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [selectedCategory]);

  if (error) {
    return (
      <div className="container py-8">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  const categoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      MUSIC: "bg-purple-100 text-purple-800",
      SPORTS: "bg-green-100 text-green-800",
      CONFERENCE: "bg-blue-100 text-blue-800",
      WORKSHOP: "bg-yellow-100 text-yellow-800",
      COMEDY: "bg-pink-100 text-pink-800",
      OTHER: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", colors[category] || colors.OTHER)}>
        {category}
      </span>
    );
  };

  return (
    <div className="container py-8">
      <section className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Discover Amazing Events</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Find and book tickets for the best concerts, workshops, and events in your area.
        </p>
      </section>

      <div className="flex gap-2 flex-wrap mb-8 justify-center">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors",
              selectedCategory === cat.value
                ? "bg-sky-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          {selectedCategory ? `${CATEGORIES.find((c) => c.value === selectedCategory)?.label} Events` : "Upcoming Events"}
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[30vh]">
            <Spinner size="lg" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No events found</h3>
            <p className="mt-2 text-gray-500">
              {selectedCategory ? "Try a different category or check back later." : "Check back later for new events."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const isSoldOut = event.soldCount >= event.capacity;
              const remainingTickets = event.capacity - event.soldCount;

              return (
                <Card key={event.id} className="hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-gray-200 relative">
                    {event.imageUrl ? (
                      <img src={event.imageUrl} alt={event.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute top-2 left-2">{categoryBadge(event.category)}</div>
                    {isSoldOut && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="danger" className="text-lg px-4 py-2">Sold Out</Badge>
                      </div>
                    )}
                  </div>

                  <CardContent className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{event.name}</h3>
                      {event.artistInfo && <p className="text-sm text-gray-500">{event.artistInfo}</p>}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{formatDate(event.date)} at {formatTime(event.time)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="line-clamp-1">{event.venue}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <span className="text-xl font-bold text-sky-600">{formatCurrency(event.price)}</span>
                        {!isSoldOut && <span className="text-sm text-gray-500 ml-2">{remainingTickets} left</span>}
                      </div>
                      <Link href={`/events/${event.id}`}>
                        <Button size="sm" disabled={isSoldOut}>{isSoldOut ? "Sold Out" : "Get Tickets"}</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
