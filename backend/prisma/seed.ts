import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

function generateTicketCode(): string {
  return randomBytes(16).toString("hex");
}

function generateQRData(ticketCode: string): string {
  return JSON.stringify({
    code: ticketCode,
    ts: Date.now(),
  });
}

async function main() {
  console.log("Seeding database...\n");

  // Clear existing data for clean restart
  await prisma.booking.deleteMany({});
  await prisma.promoCode.deleteMany({});
  await prisma.seatTier.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("Cleared existing data\n");

  // Create 2 organizers
  const organizerPassword = await hash("organizer123", 12);

  const organizer1 = await prisma.user.upsert({
    where: { email: "organizer1@example.com" },
    update: {},
    create: {
      email: "organizer1@example.com",
      password: organizerPassword,
      name: "Sarah Chen",
      role: "ORGANIZER",
      isVerified: true,
      verifiedAt: new Date("2025-01-15"),
    },
  });
  console.log("Created organizer:", organizer1.email, "(verified)");

  const organizer2 = await prisma.user.upsert({
    where: { email: "organizer2@example.com" },
    update: {},
    create: {
      email: "organizer2@example.com",
      password: organizerPassword,
      name: "Mike Johnson",
      role: "ORGANIZER",
    },
  });
  console.log("Created organizer:", organizer2.email);

  // Create 3 attendees
  const attendeePassword = await hash("attendee123", 12);

  const attendee1 = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      password: attendeePassword,
      name: "Alice Williams",
      role: "ATTENDEE",
      isVerified: true,
      verifiedAt: new Date("2025-06-01"),
    },
  });
  console.log("Created attendee:", attendee1.email, "(verified)");

  const attendee2 = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      password: attendeePassword,
      name: "Bob Martinez",
      role: "ATTENDEE",
    },
  });
  console.log("Created attendee:", attendee2.email);

  const attendee3 = await prisma.user.upsert({
    where: { email: "carol@example.com" },
    update: {},
    create: {
      email: "carol@example.com",
      password: attendeePassword,
      name: "Carol Thompson",
      role: "ATTENDEE",
    },
  });
  console.log("Created attendee:", attendee3.email);

  // Create events with categories, refund policies, and service fees
  const eventsData = [
    {
      name: "Summer Rock Festival 2026",
      description: "The biggest rock festival of the summer! Join us for three days of amazing music, great food, and unforgettable memories.",
      date: new Date("2026-07-15"),
      time: "18:00",
      venue: "Central Park Amphitheater, New York",
      imageUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800",
      artistInfo: "The Rolling Tones, Electric Dreams, Neon Nights",
      category: "MUSIC",
      price: 150,
      capacity: 5000,
      status: "PUBLISHED",
      refundPolicy: "TIERED",
      serviceFeePercent: 8,
      organizerId: organizer1.id,
    },
    {
      name: "JavaScript Mastery Workshop",
      description: "Deep dive into modern JavaScript development. Learn about ES2026 features, async patterns, and performance optimization.",
      date: new Date("2026-03-20"),
      time: "09:00",
      venue: "Tech Hub Conference Center, San Francisco",
      imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800",
      artistInfo: "Led by Senior Engineers from Top Tech Companies",
      category: "WORKSHOP",
      price: 299,
      capacity: 100,
      status: "PUBLISHED",
      refundPolicy: "FULL_REFUND",
      serviceFeePercent: 5,
      organizerId: organizer1.id,
    },
    {
      name: "Jazz Night Under the Stars",
      description: "An intimate evening of smooth jazz in a beautiful outdoor setting. Enjoy world-class musicians and fine wine.",
      date: new Date("2026-04-10"),
      time: "20:00",
      venue: "Botanical Gardens, Chicago",
      imageUrl: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800",
      artistInfo: "The Smooth Quartet, Lisa Williams Trio",
      category: "MUSIC",
      price: 85,
      capacity: 200,
      status: "PUBLISHED",
      refundPolicy: "TIERED",
      serviceFeePercent: 5,
      organizerId: organizer1.id,
    },
    {
      name: "Startup Pitch Competition",
      description: "Watch innovative startups compete for $100,000 in funding. Network with investors and entrepreneurs.",
      date: new Date("2026-05-05"),
      time: "14:00",
      venue: "Innovation Center, Austin",
      imageUrl: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800",
      artistInfo: "20+ Startups | 10 VCs | $100K Prize",
      category: "CONFERENCE",
      price: 50,
      capacity: 300,
      status: "PUBLISHED",
      refundPolicy: "TIERED",
      serviceFeePercent: 5,
      organizerId: organizer1.id,
    },
    {
      name: "Photography Workshop for Beginners",
      description: "Learn the fundamentals of photography in this hands-on workshop. Covers camera basics, composition, and lighting.",
      date: new Date("2026-06-12"),
      time: "10:00",
      venue: "Art Studio Downtown, Seattle",
      imageUrl: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800",
      artistInfo: "Instructor: Maria Chen, Award-winning Photographer",
      category: "WORKSHOP",
      price: 120,
      capacity: 25,
      status: "PUBLISHED",
      refundPolicy: "NO_REFUND",
      serviceFeePercent: 5,
      organizerId: organizer1.id,
    },
    {
      name: "EDM Beach Party",
      description: "Dance the night away at the hottest beach party of the year. Top DJs, incredible light shows, and ocean vibes.",
      date: new Date("2026-08-01"),
      time: "21:00",
      venue: "Miami Beach, South Beach Area",
      imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800",
      artistInfo: "DJ Nova, BeatMaster X, Sunset Collective",
      category: "MUSIC",
      price: 75,
      capacity: 2000,
      status: "PUBLISHED",
      refundPolicy: "TIERED",
      serviceFeePercent: 5,
      organizerId: organizer2.id,
    },
    {
      name: "Wine Tasting Experience",
      description: "Discover exquisite wines from around the world. Guided tasting with sommelier and cheese pairings included.",
      date: new Date("2026-04-25"),
      time: "19:00",
      venue: "Grand Vineyard Estate, Napa Valley",
      imageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800",
      artistInfo: "Featuring 20+ Premium Wines",
      category: "OTHER",
      price: 95,
      capacity: 50,
      status: "PUBLISHED",
      refundPolicy: "FULL_REFUND",
      serviceFeePercent: 5,
      organizerId: organizer2.id,
    },
    {
      name: "Stand-Up Comedy Night",
      description: "Laugh out loud with the funniest comedians in the country. Two hours of non-stop entertainment.",
      date: new Date("2026-05-18"),
      time: "20:30",
      venue: "The Laugh Factory, Los Angeles",
      imageUrl: "https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=800",
      artistInfo: "Kevin Hart Jr., Sarah Silverman, Dave Chappelle",
      category: "COMEDY",
      price: 65,
      capacity: 400,
      status: "PUBLISHED",
      refundPolicy: "TIERED",
      serviceFeePercent: 5,
      organizerId: organizer2.id,
    },
    {
      name: "Marathon Training Bootcamp",
      description: "Intensive 1-day training session for aspiring marathon runners. Learn proper technique and nutrition strategies.",
      date: new Date("2026-03-08"),
      time: "06:00",
      venue: "Olympic Training Center, Denver",
      imageUrl: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800",
      artistInfo: "Coach: Olympic Gold Medalist James Wilson",
      category: "SPORTS",
      price: 180,
      capacity: 30,
      status: "PUBLISHED",
      refundPolicy: "NO_REFUND",
      serviceFeePercent: 5,
      organizerId: organizer2.id,
    },
    {
      name: "AI & Machine Learning Conference",
      description: "Explore the latest breakthroughs in AI. Keynotes from industry leaders, hands-on workshops, and networking.",
      date: new Date("2026-09-22"),
      time: "08:30",
      venue: "Boston Convention Center, Boston",
      imageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800",
      artistInfo: "Speakers from OpenAI, Google DeepMind, Anthropic",
      category: "CONFERENCE",
      price: 450,
      capacity: 1000,
      status: "PUBLISHED",
      refundPolicy: "TIERED",
      serviceFeePercent: 10,
      organizerId: organizer2.id,
    },
    {
      name: "Exclusive Chef's Table Dinner",
      description: "An intimate 5-course dining experience with award-winning Chef Marco Rossi. Limited seating for a truly personal culinary journey.",
      date: new Date("2026-06-05"),
      time: "19:30",
      venue: "Rossi's Private Kitchen, Portland",
      imageUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
      artistInfo: "Chef Marco Rossi — 2-Star Michelin, James Beard Award Winner",
      category: "OTHER",
      price: 250,
      capacity: 2,
      status: "PUBLISHED",
      refundPolicy: "FULL_REFUND",
      serviceFeePercent: 5,
      organizerId: organizer1.id,
    },
  ];

  const createdEvents = [];
  for (const eventData of eventsData) {
    const event = await prisma.event.create({
      data: eventData,
    });
    createdEvents.push(event);
    console.log(`Created event: ${event.name} [${eventData.category}] (${eventData.refundPolicy})`);
  }

  // Add seat tiers to first 3 events
  console.log("\nCreating seat tiers...\n");

  const tierConfigs = [
    {
      eventIndex: 0, // Summer Rock Festival
      tiers: [
        { name: "Standing", price: 50, capacity: 3000 },
        { name: "Gold", price: 100, capacity: 1500 },
        { name: "VIP", price: 250, capacity: 500 },
      ],
    },
    {
      eventIndex: 5, // EDM Beach Party
      tiers: [
        { name: "General Admission", price: 75, capacity: 1500 },
        { name: "VIP Lounge", price: 200, capacity: 400 },
        { name: "Backstage Pass", price: 500, capacity: 100 },
      ],
    },
    {
      eventIndex: 9, // AI Conference
      tiers: [
        { name: "Standard", price: 450, capacity: 700 },
        { name: "Premium", price: 750, capacity: 250 },
        { name: "Executive", price: 1500, capacity: 50 },
      ],
    },
  ];

  const createdTiers: Record<number, any[]> = {};
  for (const config of tierConfigs) {
    createdTiers[config.eventIndex] = [];
    for (const tierData of config.tiers) {
      const tier = await prisma.seatTier.create({
        data: {
          ...tierData,
          eventId: createdEvents[config.eventIndex].id,
        },
      });
      createdTiers[config.eventIndex].push(tier);
      console.log(`  Created tier: ${tier.name} for ${createdEvents[config.eventIndex].name}`);
    }
  }

  // Add promo codes with enhanced fields
  console.log("\nCreating promo codes...\n");

  const promoConfigs = [
    {
      eventIndex: 0, code: "SUMMER20", discountType: "PERCENTAGE", discountValue: 20,
      usageLimit: 100, validFrom: new Date("2026-06-01"), validUntil: new Date("2026-07-14"),
      maxDiscountAmount: 50,
    },
    {
      eventIndex: 0, code: "FLAT15", discountType: "FIXED", discountValue: 15,
      usageLimit: null, minPurchaseAmount: 50,
    },
    {
      eventIndex: 1, code: "EARLYBIRD", discountType: "PERCENTAGE", discountValue: 15,
      usageLimit: 20, validUntil: new Date("2026-03-15"),
    },
    {
      eventIndex: 5, code: "BEACH10", discountType: "PERCENTAGE", discountValue: 10,
      usageLimit: 200, validFrom: new Date("2026-06-01"), validUntil: new Date("2026-07-31"),
    },
    {
      eventIndex: 5, code: "VIP50OFF", discountType: "FIXED", discountValue: 50,
      usageLimit: 50, minPurchaseAmount: 150,
    },
    {
      eventIndex: 9, code: "AI2026", discountType: "PERCENTAGE", discountValue: 25,
      usageLimit: 50, maxDiscountAmount: 100,
    },
  ];

  const createdPromos: Record<string, any> = {};
  for (const promoData of promoConfigs) {
    const promo = await prisma.promoCode.create({
      data: {
        code: promoData.code,
        discountType: promoData.discountType,
        discountValue: promoData.discountValue,
        usageLimit: promoData.usageLimit ?? null,
        validFrom: promoData.validFrom ?? null,
        validUntil: promoData.validUntil ?? null,
        minPurchaseAmount: promoData.minPurchaseAmount ?? null,
        maxDiscountAmount: promoData.maxDiscountAmount ?? null,
        eventId: createdEvents[promoData.eventIndex].id,
      },
    });
    createdPromos[promoData.code] = promo;
    console.log(`  Created promo: ${promo.code} for ${createdEvents[promoData.eventIndex].name}`);
  }

  // Create bookings (confirmed and some cancelled)
  console.log("\nCreating bookings...\n");

  const bookingAssignments = [
    // Alice: Events 0 (tier: Gold, with FLAT15 promo), 1, 2, 3, 4, 5 (tier: General)
    { user: attendee1, eventIndex: 0, tierId: createdTiers[0]?.[1]?.id, promoCode: "FLAT15", discountAmount: 15 },
    { user: attendee1, eventIndex: 1, tierId: null },
    { user: attendee1, eventIndex: 2, tierId: null },
    { user: attendee1, eventIndex: 3, tierId: null },
    { user: attendee1, eventIndex: 4, tierId: null },
    { user: attendee1, eventIndex: 5, tierId: createdTiers[5]?.[0]?.id },
    // Bob: Events 2, 3, 4, 5 (tier: VIP Lounge), 6, 7
    { user: attendee2, eventIndex: 2, tierId: null },
    { user: attendee2, eventIndex: 3, tierId: null },
    { user: attendee2, eventIndex: 4, tierId: null },
    { user: attendee2, eventIndex: 5, tierId: createdTiers[5]?.[1]?.id },
    { user: attendee2, eventIndex: 6, tierId: null },
    { user: attendee2, eventIndex: 7, tierId: null },
    // Carol: Events 4, 5 (tier: Backstage), 6, 7, 8, 9 (tier: Premium)
    { user: attendee3, eventIndex: 4, tierId: null },
    { user: attendee3, eventIndex: 5, tierId: createdTiers[5]?.[2]?.id },
    { user: attendee3, eventIndex: 6, tierId: null },
    { user: attendee3, eventIndex: 7, tierId: null },
    { user: attendee3, eventIndex: 8, tierId: null },
    { user: attendee3, eventIndex: 9, tierId: createdTiers[9]?.[1]?.id },
    // Chef's Table Dinner (event 10) — Alice + Bob fill capacity (sold out, non-tiered)
    { user: attendee1, eventIndex: 10, tierId: null },
    { user: attendee2, eventIndex: 10, tierId: null },
  ];

  for (const assignment of bookingAssignments) {
    const event = createdEvents[assignment.eventIndex];
    const ticketCode = generateTicketCode();
    const qrCodeData = generateQRData(ticketCode);

    // Determine price
    let pricePaid = event.price;
    if (assignment.tierId) {
      const tier = await prisma.seatTier.findUnique({ where: { id: assignment.tierId } });
      if (tier) pricePaid = tier.price;
    }

    // Apply discount if promo code used
    const discountAmount = (assignment as any).discountAmount || 0;
    const promoCode = (assignment as any).promoCode;
    const promoId = promoCode ? createdPromos[promoCode]?.id : null;
    const finalPrice = Math.round((pricePaid - discountAmount) * 100) / 100;

    await prisma.booking.create({
      data: {
        ticketCode,
        qrCodeData,
        status: "CONFIRMED",
        pricePaid: finalPrice,
        discountAmount,
        userId: assignment.user.id,
        eventId: event.id,
        seatTierId: assignment.tierId || null,
        promoCodeId: promoId,
      },
    });

    // Update sold count
    await prisma.event.update({
      where: { id: event.id },
      data: { soldCount: { increment: 1 } },
    });

    // Update tier sold count if applicable
    if (assignment.tierId) {
      await prisma.seatTier.update({
        where: { id: assignment.tierId },
        data: { soldCount: { increment: 1 } },
      });
    }

    // Update promo usage count if applicable
    if (promoId) {
      await prisma.promoCode.update({
        where: { id: promoId },
        data: { usageCount: { increment: 1 } },
      });
    }

    console.log(`Booked: ${assignment.user.name} -> ${event.name}${assignment.tierId ? " (tiered)" : ""}${promoCode ? ` (promo: ${promoCode})` : ""}`);
  }

  // Create some cancelled bookings for realistic data
  console.log("\nCreating cancelled bookings...\n");

  const cancelledBookings = [
    {
      user: attendee2,
      eventIndex: 2, // Jazz Night - TIERED policy
      pricePaid: 85,
      refundAmount: 38.25, // 50% of 85 = 42.50, minus 5% fee = 42.50 - 4.25 = 38.25
    },
    {
      user: attendee3,
      eventIndex: 8, // Marathon Bootcamp - NO_REFUND
      pricePaid: 180,
      refundAmount: 0,
    },
  ];

  for (const cancelled of cancelledBookings) {
    const event = createdEvents[cancelled.eventIndex];
    const ticketCode = generateTicketCode();
    const qrCodeData = generateQRData(ticketCode);

    await prisma.booking.create({
      data: {
        ticketCode,
        qrCodeData,
        status: "CANCELLED",
        pricePaid: cancelled.pricePaid,
        discountAmount: 0,
        refundAmount: cancelled.refundAmount,
        cancelledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        userId: cancelled.user.id,
        eventId: event.id,
      },
    });

    console.log(`Cancelled: ${cancelled.user.name} -> ${event.name} (refund: $${cancelled.refundAmount})`);
  }

  // Create waitlisted bookings for the sold-out Chef's Table Dinner (event 10)
  // These represent users who tried to book after it sold out.
  // A previous developer started implementing waitlist using the booking status pattern.
  console.log("\nCreating waitlisted bookings...\n");

  const chefTableEvent = createdEvents[10];

  // Carol is waitlisted for Chef's Table Dinner
  const carolWaitlistTicket = generateTicketCode();
  await prisma.booking.create({
    data: {
      ticketCode: carolWaitlistTicket,
      qrCodeData: generateQRData(carolWaitlistTicket),
      status: "WAITLISTED",
      pricePaid: 0,
      discountAmount: 0,
      userId: attendee3.id,
      eventId: chefTableEvent.id,
    },
  });
  console.log(`Waitlisted: ${attendee3.name} -> ${chefTableEvent.name}`);

  // Organizer2 is also waitlisted (joined after Carol)
  const org2WaitlistTicket = generateTicketCode();
  await prisma.booking.create({
    data: {
      ticketCode: org2WaitlistTicket,
      qrCodeData: generateQRData(org2WaitlistTicket),
      status: "WAITLISTED",
      pricePaid: 0,
      discountAmount: 0,
      userId: organizer2.id,
      eventId: chefTableEvent.id,
    },
  });
  console.log(`Waitlisted: ${organizer2.name} -> ${chefTableEvent.name}`);

  console.log("\n--- Seeding complete! ---");
  console.log("\n--- Test Credentials ---");
  console.log("Organizers (password: organizer123):");
  console.log("  - organizer1@example.com (Sarah Chen, verified) — events 1-5");
  console.log("  - organizer2@example.com (Mike Johnson) — events 6-10");
  console.log("\nAttendees (password: attendee123):");
  console.log("  - alice@example.com (Alice Williams, verified)");
  console.log("  - bob@example.com (Bob Martinez)");
  console.log("  - carol@example.com (Carol Thompson)");
  console.log("\nEvents with Tiers: Summer Rock Festival, EDM Beach Party, AI Conference");
  console.log("Events with Promos: Summer Rock Festival (SUMMER20, FLAT15), JS Workshop (EARLYBIRD), EDM Party (BEACH10, VIP50OFF), AI Conf (AI2026)");
  console.log("Refund Policies: JS Workshop/Chef's Table (FULL_REFUND), Photography/Marathon (NO_REFUND), Others (TIERED)");
  console.log("Categories: MUSIC(3), WORKSHOP(2), CONFERENCE(2), COMEDY(1), SPORTS(1), OTHER(2)");
  console.log("Sold Out: Chef's Table Dinner (capacity 2, Alice + Bob)");
  console.log("Waitlisted: Carol + Mike Johnson on Chef's Table Dinner");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
