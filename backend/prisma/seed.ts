import { PrismaClient, Role, type Movie, type Screen, type Theater } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, setHours, setMilliseconds, setMinutes, setSeconds, startOfDay } from "date-fns";

const prisma = new PrismaClient();

const poster = (slug: string) => `https://picsum.photos/seed/cinebook-poster-${slug}/780/1170`;
const backdrop = (slug: string) => `https://picsum.photos/seed/cinebook-backdrop-${slug}/1920/1080`;

type SeedMovie = {
  title: string;
  slug: string;
  synopsis: string;
  language: string;
  genre: string;
  rating: string;
  durationMin: number;
  cast: string[];
  releaseDate: Date;
  trailerUrl?: string;
  priceTier: "value" | "standard" | "premium" | "event";
};

const movies: SeedMovie[] = [
  {
    title: "F1: The Movie",
    slug: "f1-the-movie",
    synopsis: "A veteran Formula One driver comes out of retirement to mentor a brash young rookie at a struggling racing team chasing redemption.",
    language: "English",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 156,
    cast: ["Brad Pitt", "Damson Idris", "Kerry Condon"],
    releaseDate: new Date("2025-06-27"),
    priceTier: "premium"
  },
  {
    title: "Superman",
    slug: "superman-2025",
    synopsis: "The Man of Steel balances his Kryptonian heritage and human upbringing while facing a scheming Lex Luthor determined to discredit him.",
    language: "English",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 129,
    cast: ["David Corenswet", "Rachel Brosnahan", "Nicholas Hoult"],
    releaseDate: new Date("2025-07-11"),
    priceTier: "event"
  },
  {
    title: "Jurassic World: Rebirth",
    slug: "jurassic-world-rebirth",
    synopsis: "A covert team ventures to a forbidden island of mutated dinosaurs to extract genetic material that could revolutionize human medicine.",
    language: "English",
    genre: "Sci-Fi",
    rating: "UA 13+",
    durationMin: 133,
    cast: ["Scarlett Johansson", "Jonathan Bailey", "Mahershala Ali"],
    releaseDate: new Date("2025-07-02"),
    priceTier: "premium"
  },
  {
    title: "The Fantastic Four: First Steps",
    slug: "fantastic-four-first-steps",
    synopsis: "A family of cosmic-powered explorers must defend their retro-futuristic Earth from the planet-devouring Galactus and his herald the Silver Surfer.",
    language: "English",
    genre: "Sci-Fi",
    rating: "UA 13+",
    durationMin: 115,
    cast: ["Pedro Pascal", "Vanessa Kirby", "Ebon Moss-Bachrach"],
    releaseDate: new Date("2025-07-25"),
    priceTier: "premium"
  },
  {
    title: "28 Years Later",
    slug: "28-years-later",
    synopsis: "Decades after the rage virus outbreak, a boy leaves his isolated island community and discovers horrifying new truths about the infected mainland.",
    language: "English",
    genre: "Horror",
    rating: "A",
    durationMin: 115,
    cast: ["Aaron Taylor-Johnson", "Jodie Comer", "Ralph Fiennes"],
    releaseDate: new Date("2025-06-20"),
    priceTier: "standard"
  },
  {
    title: "Sinners",
    slug: "sinners-2025",
    synopsis: "Twin brothers return to their Mississippi hometown to open a juke joint, only to confront an ancient supernatural evil drawn to their music.",
    language: "English",
    genre: "Horror",
    rating: "A",
    durationMin: 138,
    cast: ["Michael B. Jordan", "Hailee Steinfeld", "Miles Caton"],
    releaseDate: new Date("2025-04-18"),
    priceTier: "standard"
  },
  {
    title: "Tron: Ares",
    slug: "tron-ares",
    synopsis: "A highly sophisticated artificial intelligence program crosses from the digital grid into the real world on a mission that endangers humanity.",
    language: "English",
    genre: "Sci-Fi",
    rating: "UA 13+",
    durationMin: 119,
    cast: ["Jared Leto", "Greta Lee", "Evan Peters"],
    releaseDate: new Date("2025-10-10"),
    priceTier: "standard"
  },
  {
    title: "Lilo & Stitch",
    slug: "lilo-and-stitch-2025",
    synopsis: "A lonely Hawaiian girl adopts a mischievous fugitive alien as her pet, and together they discover the true meaning of family.",
    language: "English",
    genre: "Family",
    rating: "U",
    durationMin: 108,
    cast: ["Maia Kealoha", "Sydney Elizabeth Agudong", "Chris Sanders"],
    releaseDate: new Date("2025-05-23"),
    priceTier: "standard"
  },
  {
    title: "Wicked: For Good",
    slug: "wicked-for-good",
    synopsis: "The friendship between misunderstood Elphaba and popular Glinda is tested as their paths diverge across a divided land of Oz.",
    language: "English",
    genre: "Drama",
    rating: "U",
    durationMin: 138,
    cast: ["Cynthia Erivo", "Ariana Grande", "Jonathan Bailey"],
    releaseDate: new Date("2025-11-21"),
    priceTier: "premium"
  },
  {
    title: "Avatar: Fire and Ash",
    slug: "avatar-fire-and-ash",
    synopsis: "The Sully family confronts a fierce new aggressive Na'vi clan while grappling with grief and survival on the moon of Pandora.",
    language: "English",
    genre: "Sci-Fi",
    rating: "UA 13+",
    durationMin: 197,
    cast: ["Sam Worthington", "Zoe Saldana", "Sigourney Weaver"],
    releaseDate: new Date("2025-12-19"),
    priceTier: "event"
  },
  {
    title: "Spider-Man: Brand New Day",
    slug: "spider-man-brand-new-day",
    synopsis: "Peter Parker fights crime alone in a New York that has forgotten him, facing fresh threats while rebuilding his fractured life.",
    language: "English",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 130,
    cast: ["Tom Holland", "Zendaya", "Jacob Batalon"],
    releaseDate: new Date("2026-07-31"),
    priceTier: "event"
  },
  {
    title: "Avengers: Doomsday",
    slug: "avengers-doomsday",
    synopsis: "Earth's mightiest heroes unite across the multiverse to stand against the tyrannical Doctor Doom in a confrontation that threatens all reality.",
    language: "English",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 160,
    cast: ["Robert Downey Jr.", "Chris Hemsworth", "Anthony Mackie"],
    releaseDate: new Date("2026-12-18"),
    priceTier: "event"
  },
  {
    title: "Saiyaara",
    slug: "saiyaara",
    synopsis: "A hot-headed aspiring musician and a reserved young writer fall deeply in love, but fate tests their bond in heartbreaking ways.",
    language: "Hindi",
    genre: "Romance",
    rating: "UA 13+",
    durationMin: 156,
    cast: ["Ahaan Panday", "Aneet Padda", "Varun Badola"],
    releaseDate: new Date("2025-07-18"),
    priceTier: "standard"
  },
  {
    title: "War 2",
    slug: "war-2",
    synopsis: "A rogue agent of an elite Indian spy program is hunted by a deadly rival as loyalties and secrets violently unravel.",
    language: "Hindi",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 173,
    cast: ["Hrithik Roshan", "N. T. Rama Rao Jr.", "Kiara Advani"],
    releaseDate: new Date("2025-08-14"),
    priceTier: "premium"
  },
  {
    title: "Thamma",
    slug: "thamma",
    synopsis: "A man falls for a mysterious woman from an ancient tribe of Indian vampires, plunging him into a supernatural world of romance and danger.",
    language: "Hindi",
    genre: "Horror",
    rating: "UA 13+",
    durationMin: 149,
    cast: ["Ayushmann Khurrana", "Rashmika Mandanna", "Nawazuddin Siddiqui"],
    releaseDate: new Date("2025-10-21"),
    priceTier: "standard"
  },
  {
    title: "Param Sundari",
    slug: "param-sundari",
    synopsis: "A Delhi boy uses a matchmaking app that leads him to a spirited Kerala girl, sparking a clash of cultures and unexpected romance.",
    language: "Hindi",
    genre: "Romance",
    rating: "UA 13+",
    durationMin: 136,
    cast: ["Sidharth Malhotra", "Janhvi Kapoor", "Sanjay Kapoor"],
    releaseDate: new Date("2025-08-29"),
    priceTier: "standard"
  },
  {
    title: "Mahavatar Narsimha",
    slug: "mahavatar-narsimha",
    synopsis: "This animated mythological epic retells how the fierce half-man half-lion avatar of Vishnu emerges to vanquish a tyrannical demon king.",
    language: "Hindi",
    genre: "Animation",
    rating: "UA 7+",
    durationMin: 141,
    cast: ["Aditya Raj Sharma", "Haripriya Matta", "Harjeet Walia"],
    releaseDate: new Date("2025-07-25"),
    priceTier: "value"
  },
  {
    title: "They Call Him OG",
    slug: "they-call-him-og",
    synopsis: "A legendary retired gangster returns to the violent underworld of the city to settle old scores and protect those he loves.",
    language: "Telugu",
    genre: "Action",
    rating: "UA 16+",
    durationMin: 156,
    cast: ["Pawan Kalyan", "Emraan Hashmi", "Priyanka Mohan"],
    releaseDate: new Date("2025-09-25"),
    priceTier: "premium"
  },
  {
    title: "The Girlfriend",
    slug: "the-girlfriend-2025",
    synopsis: "A literature student navigates a college romance that gradually forces her to confront questions of identity, love, and personal boundaries.",
    language: "Telugu",
    genre: "Romance",
    rating: "UA 13+",
    durationMin: 138,
    cast: ["Rashmika Mandanna", "Dheekshith Shetty", "Anu Emmanuel"],
    releaseDate: new Date("2025-11-07"),
    priceTier: "standard"
  },
  {
    title: "Kingdom",
    slug: "kingdom-2025-telugu",
    synopsis: "A troubled police officer goes undercover on an island crime syndicate, where the mission collides painfully with his buried family past.",
    language: "Telugu",
    genre: "Action",
    rating: "UA 16+",
    durationMin: 165,
    cast: ["Vijay Deverakonda", "Bhagyashri Borse", "Satya Dev"],
    releaseDate: new Date("2025-07-31"),
    priceTier: "standard"
  },
  {
    title: "Peddi",
    slug: "peddi",
    synopsis: "In 1980s rural Andhra Pradesh, a spirited villager rallies his community through sport to defend their pride against a powerful rival.",
    language: "Telugu",
    genre: "Drama",
    rating: "UA 13+",
    durationMin: 165,
    cast: ["Ram Charan", "Janhvi Kapoor", "Shiva Rajkumar"],
    releaseDate: new Date("2026-06-04"),
    priceTier: "event"
  },
  {
    title: "Coolie",
    slug: "coolie-2025",
    synopsis: "An aging former gang enforcer returns to investigate the death of an old friend, unraveling a brutal smuggling conspiracy.",
    language: "Tamil",
    genre: "Action",
    rating: "UA 16+",
    durationMin: 170,
    cast: ["Rajinikanth", "Nagarjuna Akkineni", "Shruti Haasan"],
    releaseDate: new Date("2025-08-14"),
    priceTier: "premium"
  },
  {
    title: "Dragon",
    slug: "dragon-2025-tamil",
    synopsis: "A struggling college drop-out fakes his credentials to land a high-paying job, then must scramble to keep his web of lies from collapsing.",
    language: "Tamil",
    genre: "Comedy",
    rating: "UA 13+",
    durationMin: 155,
    cast: ["Pradeep Ranganathan", "Anupama Parameswaran", "Kayadu Lohar"],
    releaseDate: new Date("2025-02-21"),
    priceTier: "value"
  },
  {
    title: "Jana Nayagan",
    slug: "jana-nayagan",
    synopsis: "A principled leader rises against entrenched corruption in a sweeping political action drama marking a superstar's final on-screen appearance.",
    language: "Tamil",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 160,
    cast: ["Vijay", "Pooja Hegde", "Bobby Deol"],
    releaseDate: new Date("2026-06-22"),
    priceTier: "event"
  },
  {
    title: "Lokah Chapter 1: Chandra",
    slug: "lokah-chapter-1-chandra",
    synopsis: "A mysterious young woman with hidden supernatural powers becomes entangled with a small group as a dark fantasy world reveals itself.",
    language: "Malayalam",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 152,
    cast: ["Kalyani Priyadarshan", "Naslen", "Sandy Chandu"],
    releaseDate: new Date("2025-08-28"),
    priceTier: "premium"
  },
  {
    title: "Hridayapoorvam",
    slug: "hridayapoorvam",
    synopsis: "After a life-saving heart transplant, a man attends the donor family's celebration and forms warm, unexpected bonds that reshape his life.",
    language: "Malayalam",
    genre: "Drama",
    rating: "U",
    durationMin: 145,
    cast: ["Mohanlal", "Malavika Mohanan", "Sangeeth Prathap"],
    releaseDate: new Date("2025-08-28"),
    priceTier: "standard"
  },
  {
    title: "Kantara: Chapter 1",
    slug: "kantara-chapter-1",
    synopsis: "A sweeping mythological prequel set in an ancient kingdom explores the origins of a sacred forest ritual and a clan's divine destiny.",
    language: "Kannada",
    genre: "Drama",
    rating: "UA 16+",
    durationMin: 169,
    cast: ["Rishab Shetty", "Rukmini Vasanth", "Gulshan Devaiah"],
    releaseDate: new Date("2025-10-02"),
    priceTier: "event"
  },
  {
    title: "Su From So",
    slug: "su-from-so",
    synopsis: "Rumors of a haunting spiral out of control in a coastal village, turning everyday superstition into uproarious comic chaos.",
    language: "Kannada",
    genre: "Comedy",
    rating: "UA 13+",
    durationMin: 138,
    cast: ["Shaneel Gautham", "JP Thuminad", "Sandhya Arakere"],
    releaseDate: new Date("2025-07-25"),
    priceTier: "value"
  },
  {
    title: "Demon Slayer: Infinity Castle",
    slug: "demon-slayer-infinity-castle",
    synopsis: "Demon-slaying warriors plunge into a shifting fortress to confront the demon king's elite forces in the climactic battle of their war.",
    language: "Japanese",
    genre: "Animation",
    rating: "UA 16+",
    durationMin: 155,
    cast: ["Natsuki Hanae", "Akari Kito", "Hiro Shimono"],
    releaseDate: new Date("2025-09-12"),
    priceTier: "premium"
  },
  {
    title: "Chainsaw Man: Reze Arc",
    slug: "chainsaw-man-reze-arc",
    synopsis: "A devil-hunting young man falls for a charming girl at a cafe, unaware she hides a deadly secret that endangers everything.",
    language: "Japanese",
    genre: "Animation",
    rating: "A",
    durationMin: 100,
    cast: ["Kikunosuke Toya", "Tomori Kusunoki", "Reina Ueda"],
    releaseDate: new Date("2025-09-19"),
    priceTier: "standard"
  },
  {
    title: "Yadang: The Snitch",
    slug: "yadang-the-snitch",
    synopsis: "A cunning criminal informant, an ambitious prosecutor, and a relentless detective collide while trying to bring down a major drug ring.",
    language: "Korean",
    genre: "Crime",
    rating: "A",
    durationMin: 122,
    cast: ["Kang Ha-neul", "Yoo Hae-jin", "Park Hae-joon"],
    releaseDate: new Date("2025-04-16"),
    priceTier: "value"
  },
  {
    title: "Omniscient Reader: The Prophecy",
    slug: "omniscient-reader-the-prophecy",
    synopsis: "An ordinary reader is the only one who knows how a doomsday scenario from his favorite web novel will unfold as reality collapses.",
    language: "Korean",
    genre: "Action",
    rating: "UA 16+",
    durationMin: 116,
    cast: ["Ahn Hyo-seop", "Lee Min-ho", "Chae Soo-bin"],
    releaseDate: new Date("2025-07-23"),
    priceTier: "standard"
  }
];

const theaters = [
  {
    chain: "PVR",
    name: "CineBook Luxe",
    city: "Bengaluru",
    address: "Indiranagar 100 Feet Road",
    screens: [
      { name: "Screen 1", type: "IMAX", format: "3D", equipment: ["IMAX", "Laser Projection"], rows: 8, seatsPerRow: 12 },
      { name: "Screen 2", type: "Dolby Atmos", format: "2D", equipment: ["Dolby Atmos", "Recliner Rows"], rows: 7, seatsPerRow: 10 }
    ]
  },
  {
    chain: "INOX",
    name: "CineBook Central",
    city: "Mumbai",
    address: "Lower Parel High Street",
    screens: [
      { name: "Screen 1", type: "Dolby Atmos", format: "2D", equipment: ["Dolby Atmos", "Laser Projection"], rows: 7, seatsPerRow: 11 },
      { name: "Screen 2", type: "Standard", format: "2D", equipment: ["Comfort Seats"], rows: 6, seatsPerRow: 10 }
    ]
  },
  {
    chain: "Cinepolis",
    name: "CineBook Marina",
    city: "Chennai",
    address: "OMR Expressway",
    screens: [
      { name: "Screen 1", type: "Premium Large Format", format: "3D", equipment: ["Laser Projection", "Wide Screen"], rows: 8, seatsPerRow: 12 },
      { name: "Screen 2", type: "Dolby Atmos", format: "2D", equipment: ["Dolby Atmos"], rows: 6, seatsPerRow: 10 }
    ]
  },
  {
    chain: "PVR",
    name: "CineBook Forum",
    city: "Hyderabad",
    address: "Hitech City Main Road",
    screens: [
      { name: "Screen 1", type: "IMAX", format: "3D", equipment: ["IMAX", "Laser Projection"], rows: 8, seatsPerRow: 12 },
      { name: "Screen 2", type: "Standard", format: "2D", equipment: ["Accessible Seating"], rows: 6, seatsPerRow: 10 }
    ]
  },
  {
    chain: "Miraj",
    name: "CineBook Heritage",
    city: "Kochi",
    address: "Marine Drive",
    screens: [
      { name: "Screen 1", type: "Dolby Atmos", format: "2D", equipment: ["Dolby Atmos", "Recliner Rows"], rows: 6, seatsPerRow: 10 }
    ]
  }
] as const;

const priceByTier = {
  value: 180,
  standard: 260,
  premium: 340,
  event: 430
} satisfies Record<SeedMovie["priceTier"], number>;

async function ensureUsers() {
  const passwordHash = await bcrypt.hash("Demo@123", 12);
  const adminHash = await bcrypt.hash("Admin@123", 12);
  const managerHash = await bcrypt.hash("Manager@123", 12);

  return Promise.all([
    prisma.user.upsert({
      where: { email: "demo@cinebook.local" },
      update: { name: "Demo User", role: Role.USER, phone: "+919000000001", phoneVerified: true, disabled: false },
      create: { name: "Demo User", email: "demo@cinebook.local", phone: "+919000000001", phoneVerified: true, passwordHash, role: Role.USER }
    }),
    prisma.user.upsert({
      where: { email: "admin@cinebook.local" },
      update: { name: "Admin", role: Role.ADMIN, phone: "+919000000002", phoneVerified: true, disabled: false },
      create: { name: "Admin", email: "admin@cinebook.local", phone: "+919000000002", phoneVerified: true, passwordHash: adminHash, role: Role.ADMIN }
    }),
    prisma.user.upsert({
      where: { email: "manager@cinebook.local" },
      update: { name: "Hall Manager", role: Role.HALL_MANAGER, phone: "+919000000003", phoneVerified: true, disabled: false },
      create: {
        name: "Hall Manager",
        email: "manager@cinebook.local",
        phone: "+919000000003",
        phoneVerified: true,
        passwordHash: managerHash,
        role: Role.HALL_MANAGER
      }
    })
  ]);
}

async function ensureTheater(input: (typeof theaters)[number]) {
  const existing = await prisma.theater.findFirst({
    where: { chain: input.chain, name: input.name, city: input.city }
  });

  if (existing) {
    return prisma.theater.update({
      where: { id: existing.id },
      data: { address: input.address }
    });
  }

  return prisma.theater.create({
    data: {
      chain: input.chain,
      name: input.name,
      city: input.city,
      address: input.address
    }
  });
}

async function ensureScreen(theater: Theater, input: (typeof theaters)[number]["screens"][number]) {
  const existing = await prisma.screen.findFirst({
    where: { theaterId: theater.id, name: input.name }
  });

  const screen = existing
    ? await prisma.screen.update({
        where: { id: existing.id },
        data: { type: input.type, format: input.format, equipment: [...input.equipment] }
      })
    : await prisma.screen.create({
        data: {
          theaterId: theater.id,
          name: input.name,
          type: input.type,
          format: input.format,
          equipment: [...input.equipment]
        }
      });

  const seatCount = await prisma.seat.count({ where: { screenId: screen.id } });
  if (seatCount === 0) {
    await prisma.seat.createMany({
      data: Array.from({ length: input.rows }).flatMap((_, rowIndex) => {
        const row = String.fromCharCode(65 + rowIndex);
        const type = rowIndex === 0 ? "Front Row" : rowIndex >= input.rows - 2 ? "Recliner" : rowIndex >= input.rows - 4 ? "Premium" : "Standard";
        const priceModifier = type === "Front Row" ? -60 : type === "Premium" ? 120 : type === "Recliner" ? 240 : 0;
        return Array.from({ length: input.seatsPerRow }).map((__, seatIndex) => ({
          screenId: screen.id,
          row,
          number: seatIndex + 1,
          type,
          priceModifier
        }));
      })
    });
  }

  return screen;
}

async function ensureMovies() {
  const records: Movie[] = [];

  for (const movie of movies) {
    const record = await prisma.movie.upsert({
      where: { slug: movie.slug },
      update: {
        title: movie.title,
        synopsis: movie.synopsis,
        language: movie.language,
        genre: movie.genre,
        rating: movie.rating,
        durationMin: movie.durationMin,
        posterUrl: poster(movie.slug),
        backdropUrl: backdrop(movie.slug),
        trailerUrl: movie.trailerUrl,
        cast: movie.cast,
        releaseDate: movie.releaseDate
      },
      create: {
        title: movie.title,
        slug: movie.slug,
        synopsis: movie.synopsis,
        language: movie.language,
        genre: movie.genre,
        rating: movie.rating,
        durationMin: movie.durationMin,
        posterUrl: poster(movie.slug),
        backdropUrl: backdrop(movie.slug),
        trailerUrl: movie.trailerUrl,
        cast: movie.cast,
        releaseDate: movie.releaseDate
      }
    });
    records.push(record);
  }

  return records;
}

async function ensureShow(movie: Movie, screen: Screen, startsAt: Date, basePrice: number) {
  const existing = await prisma.show.findFirst({
    where: { movieId: movie.id, screenId: screen.id, startsAt }
  });

  if (existing) return existing;

  return prisma.show.create({
    data: {
      movieId: movie.id,
      screenId: screen.id,
      startsAt,
      basePrice
    }
  });
}

async function ensureShows(movieRecords: Movie[], screens: Screen[]) {
  const today = startOfDay(new Date());
  const hourSlots = [10, 13, 16, 19, 22];
  let created = 0;

  for (let index = 0; index < movieRecords.length; index += 1) {
    const movie = movieRecords[index];
    const seedMovie = movies.find((item) => item.slug === movie.slug)!;
    const existingFutureShows = await prisma.show.count({
      where: { movieId: movie.id, startsAt: { gte: new Date() } }
    });

    if (existingFutureShows > 0) continue;

    const showCount = seedMovie.priceTier === "event" || seedMovie.priceTier === "premium" ? 4 : 3;
    for (let offset = 0; offset < showCount; offset += 1) {
      const day = 1 + ((index + offset) % 10);
      const hour = hourSlots[(index + offset * 2) % hourSlots.length];
      const screen = screens[(index + offset) % screens.length];
      const startsAt = setMilliseconds(setSeconds(setMinutes(setHours(addDays(today, day), hour), 0), 0), 0);
      await ensureShow(movie, screen, startsAt, priceByTier[seedMovie.priceTier]);
      created += 1;
    }
  }

  return created;
}

// This seed is idempotent and non-destructive: every entity is upserted by a
// natural key and no rows are ever deleted, so any existing catalog preserved
// across re-runs — including real users, bookings, and payments on production.
async function main() {
  const [demoUser, adminUser, managerUser] = await ensureUsers();
  const screens: Screen[] = [];

  for (const theaterInput of theaters) {
    const theater = await ensureTheater(theaterInput);
    for (const screenInput of theaterInput.screens) {
      screens.push(await ensureScreen(theater, screenInput));
    }
  }

  const firstManagedScreen = screens[0] ?? (await prisma.screen.findFirst({ orderBy: { name: "asc" } }));
  if (firstManagedScreen) {
    await prisma.screenManager.upsert({
      where: { userId_screenId: { userId: managerUser.id, screenId: firstManagedScreen.id } },
      update: {},
      create: { userId: managerUser.id, screenId: firstManagedScreen.id }
    });
  }

  const movieRecords = await ensureMovies();
  const createdShows = await ensureShows(movieRecords, screens);

  console.log(
    [
      `Seed users ensured (${demoUser.email}, ${adminUser.email}, ${managerUser.email}).`,
      `Catalog ensured (${movieRecords.length} movies, ${screens.length} screens).`,
      `Future shows created: ${createdShows}.`
    ].join(" ")
  );
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
