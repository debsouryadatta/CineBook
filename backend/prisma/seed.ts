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
    title: "Dune: Part Two",
    slug: "dune-part-two",
    synopsis: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
    language: "English",
    genre: "Sci-Fi",
    rating: "UA 13+",
    durationMin: 166,
    cast: ["Timothee Chalamet", "Zendaya", "Rebecca Ferguson"],
    releaseDate: new Date("2024-03-01"),
    trailerUrl: "https://www.youtube.com/watch?v=Way9Dexny3w",
    priceTier: "premium"
  },
  {
    title: "Oppenheimer",
    slug: "oppenheimer",
    synopsis: "A sweeping biography of J. Robert Oppenheimer and the creation of the atomic bomb during the Manhattan Project.",
    language: "English",
    genre: "Biography",
    rating: "UA 16+",
    durationMin: 181,
    cast: ["Cillian Murphy", "Emily Blunt", "Robert Downey Jr."],
    releaseDate: new Date("2023-07-21"),
    trailerUrl: "https://www.youtube.com/watch?v=uYPbbksJxIg",
    priceTier: "premium"
  },
  {
    title: "Spider-Man: Across the Spider-Verse",
    slug: "spider-man-across-the-spider-verse",
    synopsis: "Miles Morales travels across the multiverse and meets a team charged with protecting its existence.",
    language: "English",
    genre: "Animation",
    rating: "U",
    durationMin: 140,
    cast: ["Shameik Moore", "Hailee Steinfeld", "Oscar Isaac"],
    releaseDate: new Date("2023-06-02"),
    trailerUrl: "https://www.youtube.com/watch?v=cqGjhVJWtEg",
    priceTier: "standard"
  },
  {
    title: "Inside Out 2",
    slug: "inside-out-2",
    synopsis: "Riley enters her teenage years as new emotions arrive at headquarters and shake up the old balance.",
    language: "English",
    genre: "Family",
    rating: "U",
    durationMin: 96,
    cast: ["Amy Poehler", "Maya Hawke", "Phyllis Smith"],
    releaseDate: new Date("2024-06-14"),
    trailerUrl: "https://www.youtube.com/watch?v=LEjhY15eCx0",
    priceTier: "standard"
  },
  {
    title: "Godzilla x Kong: The New Empire",
    slug: "godzilla-x-kong-the-new-empire",
    synopsis: "Kong and Godzilla face a colossal hidden threat that challenges their survival and humanity's future.",
    language: "English",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 115,
    cast: ["Rebecca Hall", "Brian Tyree Henry", "Dan Stevens"],
    releaseDate: new Date("2024-03-29"),
    trailerUrl: "https://www.youtube.com/watch?v=lV1OOlGwExM",
    priceTier: "premium"
  },
  {
    title: "Mission: Impossible - Dead Reckoning",
    slug: "mission-impossible-dead-reckoning",
    synopsis: "Ethan Hunt and his team race against time to stop a dangerous AI weapon from changing global power forever.",
    language: "English",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 163,
    cast: ["Tom Cruise", "Hayley Atwell", "Ving Rhames"],
    releaseDate: new Date("2023-07-12"),
    trailerUrl: "https://www.youtube.com/watch?v=avz06PDqDbM",
    priceTier: "premium"
  },
  {
    title: "John Wick: Chapter 4",
    slug: "john-wick-chapter-4",
    synopsis: "John Wick takes his fight against the High Table global as old alliances and new enemies close in.",
    language: "English",
    genre: "Action",
    rating: "A",
    durationMin: 169,
    cast: ["Keanu Reeves", "Donnie Yen", "Bill Skarsgard"],
    releaseDate: new Date("2023-03-24"),
    trailerUrl: "https://www.youtube.com/watch?v=qEVUtrk8_B4",
    priceTier: "event"
  },
  {
    title: "A Quiet Place: Day One",
    slug: "a-quiet-place-day-one",
    synopsis: "A woman in New York fights to survive the first hours of an alien invasion where silence means life.",
    language: "English",
    genre: "Horror",
    rating: "UA 16+",
    durationMin: 99,
    cast: ["Lupita Nyongo", "Joseph Quinn", "Alex Wolff"],
    releaseDate: new Date("2024-06-28"),
    trailerUrl: "https://www.youtube.com/watch?v=YPY7J-flzE8",
    priceTier: "standard"
  },
  {
    title: "Barbie",
    slug: "barbie",
    synopsis: "Barbie leaves her perfect world for the real one and discovers questions of identity, purpose, and joy.",
    language: "English",
    genre: "Comedy",
    rating: "UA 13+",
    durationMin: 114,
    cast: ["Margot Robbie", "Ryan Gosling", "America Ferrera"],
    releaseDate: new Date("2023-07-21"),
    trailerUrl: "https://www.youtube.com/watch?v=pBk4NYhWNMM",
    priceTier: "standard"
  },
  {
    title: "La La Land",
    slug: "la-la-land",
    synopsis: "An aspiring actor and a jazz musician fall in love while chasing their dreams in Los Angeles.",
    language: "English",
    genre: "Musical",
    rating: "UA 13+",
    durationMin: 128,
    cast: ["Ryan Gosling", "Emma Stone", "John Legend"],
    releaseDate: new Date("2016-12-09"),
    trailerUrl: "https://www.youtube.com/watch?v=0pdqf4P9MB8",
    priceTier: "value"
  },
  {
    title: "The Batman",
    slug: "the-batman",
    synopsis: "Batman investigates corruption in Gotham after a sadistic killer leaves clues for the city's elite.",
    language: "English",
    genre: "Crime",
    rating: "UA 16+",
    durationMin: 176,
    cast: ["Robert Pattinson", "Zoe Kravitz", "Paul Dano"],
    releaseDate: new Date("2022-03-04"),
    trailerUrl: "https://www.youtube.com/watch?v=mqqft2x_Aa4",
    priceTier: "premium"
  },
  {
    title: "Interstellar",
    slug: "interstellar",
    synopsis: "A team of explorers travels through a wormhole to find a new home for humanity.",
    language: "English",
    genre: "Sci-Fi",
    rating: "UA 13+",
    durationMin: 169,
    cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"],
    releaseDate: new Date("2014-11-07"),
    trailerUrl: "https://www.youtube.com/watch?v=zSWdZVtXT7E",
    priceTier: "event"
  },
  {
    title: "Jawan",
    slug: "jawan",
    synopsis: "A driven jailer and his team take on corruption through high-stakes missions that expose powerful wrongdoers.",
    language: "Hindi",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 169,
    cast: ["Shah Rukh Khan", "Nayanthara", "Vijay Sethupathi"],
    releaseDate: new Date("2023-09-07"),
    trailerUrl: "https://www.youtube.com/watch?v=MWOlnZSnXJo",
    priceTier: "premium"
  },
  {
    title: "12th Fail",
    slug: "12th-fail",
    synopsis: "A young man from Chambal restarts his academic journey while preparing for one of India's toughest exams.",
    language: "Hindi",
    genre: "Drama",
    rating: "U",
    durationMin: 147,
    cast: ["Vikrant Massey", "Medha Shankr", "Anant V Joshi"],
    releaseDate: new Date("2023-10-27"),
    trailerUrl: "https://www.youtube.com/watch?v=WeMJo701mvQ",
    priceTier: "value"
  },
  {
    title: "Rocky Aur Rani Kii Prem Kahaani",
    slug: "rocky-aur-rani-kii-prem-kahaani",
    synopsis: "A flamboyant Punjabi man and an intellectual Bengali journalist swap homes before deciding on marriage.",
    language: "Hindi",
    genre: "Romance",
    rating: "UA 13+",
    durationMin: 168,
    cast: ["Ranveer Singh", "Alia Bhatt", "Dharmendra"],
    releaseDate: new Date("2023-07-28"),
    trailerUrl: "https://www.youtube.com/watch?v=6mdxy3zohEk",
    priceTier: "standard"
  },
  {
    title: "Stree 2",
    slug: "stree-2",
    synopsis: "The town of Chanderi faces a new supernatural threat as old friends reunite for another strange case.",
    language: "Hindi",
    genre: "Horror Comedy",
    rating: "UA 13+",
    durationMin: 149,
    cast: ["Rajkummar Rao", "Shraddha Kapoor", "Pankaj Tripathi"],
    releaseDate: new Date("2024-08-15"),
    trailerUrl: "https://www.youtube.com/watch?v=KVnheXywIbY",
    priceTier: "standard"
  },
  {
    title: "Kalki 2898 AD",
    slug: "kalki-2898-ad",
    synopsis: "In a dystopian future, a bounty hunter becomes entangled in a mythic battle that could reshape humanity.",
    language: "Telugu",
    genre: "Sci-Fi",
    rating: "UA 13+",
    durationMin: 181,
    cast: ["Prabhas", "Amitabh Bachchan", "Deepika Padukone"],
    releaseDate: new Date("2024-06-27"),
    trailerUrl: "https://www.youtube.com/watch?v=y1-w1kUGuz8",
    priceTier: "event"
  },
  {
    title: "RRR",
    slug: "rrr",
    synopsis: "Two revolutionaries cross paths before taking on the British empire in a sweeping fictional epic.",
    language: "Telugu",
    genre: "Action",
    rating: "UA 13+",
    durationMin: 187,
    cast: ["N. T. Rama Rao Jr.", "Ram Charan", "Alia Bhatt"],
    releaseDate: new Date("2022-03-25"),
    trailerUrl: "https://www.youtube.com/watch?v=NgBoMJy386M",
    priceTier: "event"
  },
  {
    title: "Pushpa: The Rise",
    slug: "pushpa-the-rise",
    synopsis: "A daily wage worker rises through a red sandalwood smuggling syndicate while making dangerous enemies.",
    language: "Telugu",
    genre: "Action",
    rating: "UA 16+",
    durationMin: 179,
    cast: ["Allu Arjun", "Rashmika Mandanna", "Fahadh Faasil"],
    releaseDate: new Date("2021-12-17"),
    trailerUrl: "https://www.youtube.com/watch?v=Q1NKMPhP8PY",
    priceTier: "premium"
  },
  {
    title: "Leo",
    slug: "leo",
    synopsis: "A cafe owner with a quiet family life is pulled into violence when gangsters claim he has a hidden past.",
    language: "Tamil",
    genre: "Thriller",
    rating: "UA 16+",
    durationMin: 164,
    cast: ["Vijay", "Trisha Krishnan", "Sanjay Dutt"],
    releaseDate: new Date("2023-10-19"),
    trailerUrl: "https://www.youtube.com/watch?v=Po3jStA673E",
    priceTier: "premium"
  },
  {
    title: "Vikram",
    slug: "vikram",
    synopsis: "A black-ops squad uncovers a larger drug network while investigating a chain of masked killings.",
    language: "Tamil",
    genre: "Action",
    rating: "UA 16+",
    durationMin: 174,
    cast: ["Kamal Haasan", "Vijay Sethupathi", "Fahadh Faasil"],
    releaseDate: new Date("2022-06-03"),
    trailerUrl: "https://www.youtube.com/watch?v=OKBMCL-frPU",
    priceTier: "event"
  },
  {
    title: "Maharaja",
    slug: "maharaja",
    synopsis: "A quiet barber reports a strange theft, sending police into a layered mystery of grief and revenge.",
    language: "Tamil",
    genre: "Mystery",
    rating: "UA 16+",
    durationMin: 141,
    cast: ["Vijay Sethupathi", "Anurag Kashyap", "Mamta Mohandas"],
    releaseDate: new Date("2024-06-14"),
    trailerUrl: "https://www.youtube.com/watch?v=zIctfyB4nUo",
    priceTier: "standard"
  },
  {
    title: "Manjummel Boys",
    slug: "manjummel-boys",
    synopsis: "A group of friends from Kochi fight impossible odds after a trip to the Guna Caves turns dangerous.",
    language: "Malayalam",
    genre: "Survival Thriller",
    rating: "UA 13+",
    durationMin: 135,
    cast: ["Soubin Shahir", "Sreenath Bhasi", "Balu Varghese"],
    releaseDate: new Date("2024-02-22"),
    trailerUrl: "https://www.youtube.com/watch?v=IDiYoLznEPE",
    priceTier: "standard"
  },
  {
    title: "Aavesham",
    slug: "aavesham",
    synopsis: "College students in Bengaluru seek help from a flamboyant local gangster and land in more trouble.",
    language: "Malayalam",
    genre: "Comedy",
    rating: "UA 16+",
    durationMin: 158,
    cast: ["Fahadh Faasil", "Sajin Gopu", "Mithun Jai Shankar"],
    releaseDate: new Date("2024-04-11"),
    trailerUrl: "https://www.youtube.com/watch?v=PU2fKCb9u7E",
    priceTier: "standard"
  },
  {
    title: "Kantara",
    slug: "kantara",
    synopsis: "A village conflict over forest land awakens questions of tradition, power, and divine justice.",
    language: "Kannada",
    genre: "Folklore Thriller",
    rating: "UA 16+",
    durationMin: 148,
    cast: ["Rishab Shetty", "Sapthami Gowda", "Kishore"],
    releaseDate: new Date("2022-09-30"),
    trailerUrl: "https://www.youtube.com/watch?v=8mrVmf239GU",
    priceTier: "premium"
  },
  {
    title: "Sapta Sagaradaache Ello - Side A",
    slug: "sapta-sagaradaache-ello-side-a",
    synopsis: "A devoted couple's dream of a better life is tested by one desperate choice and its lasting cost.",
    language: "Kannada",
    genre: "Romance",
    rating: "UA 13+",
    durationMin: 142,
    cast: ["Rakshit Shetty", "Rukmini Vasanth", "Chaithra J Achar"],
    releaseDate: new Date("2023-09-01"),
    trailerUrl: "https://www.youtube.com/watch?v=YwU8SH1Mu6E",
    priceTier: "value"
  },
  {
    title: "Parasite",
    slug: "parasite",
    synopsis: "A poor family infiltrates a wealthy household in a sharp thriller about class, survival, and deception.",
    language: "Korean",
    genre: "Thriller",
    rating: "A",
    durationMin: 132,
    cast: ["Song Kang-ho", "Cho Yeo-jeong", "Choi Woo-shik"],
    releaseDate: new Date("2019-05-30"),
    trailerUrl: "https://www.youtube.com/watch?v=5xH0HfJHsaY",
    priceTier: "value"
  },
  {
    title: "Your Name",
    slug: "your-name",
    synopsis: "Two teenagers mysteriously swap bodies and search for each other across time, memory, and disaster.",
    language: "Japanese",
    genre: "Anime",
    rating: "U",
    durationMin: 107,
    cast: ["Ryunosuke Kamiki", "Mone Kamishiraishi", "Ryo Narita"],
    releaseDate: new Date("2016-08-26"),
    trailerUrl: "https://www.youtube.com/watch?v=xU47nhruN-Q",
    priceTier: "value"
  },
  {
    title: "Coco",
    slug: "coco",
    synopsis: "A young musician enters the Land of the Dead to uncover his family history and the truth behind his dreams.",
    language: "English",
    genre: "Animation",
    rating: "U",
    durationMin: 105,
    cast: ["Anthony Gonzalez", "Gael Garcia Bernal", "Benjamin Bratt"],
    releaseDate: new Date("2017-11-22"),
    trailerUrl: "https://www.youtube.com/watch?v=Rvr68u6k5sI",
    priceTier: "value"
  },
  {
    title: "Free Solo",
    slug: "free-solo",
    synopsis: "Climber Alex Honnold prepares to scale El Capitan without ropes in a tense documentary portrait.",
    language: "English",
    genre: "Documentary",
    rating: "UA 13+",
    durationMin: 100,
    cast: ["Alex Honnold", "Tommy Caldwell", "Jimmy Chin"],
    releaseDate: new Date("2018-09-28"),
    trailerUrl: "https://www.youtube.com/watch?v=urRVZ4SW7WU",
    priceTier: "value"
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
