String _str(dynamic v, [String fallback = '']) => v is String ? v : fallback;

int _int(dynamic v, [int fallback = 0]) {
  if (v is int) return v;
  if (v is num) return v.round();
  if (v is String) return int.tryParse(v) ?? fallback;
  return fallback;
}

DateTime? _date(dynamic v) {
  if (v is String && v.isNotEmpty) return DateTime.tryParse(v);
  return null;
}

List<String> _strList(dynamic v) =>
    v is List ? v.whereType<String>().toList() : const [];

class User {
  User({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    required this.phoneVerified,
    required this.role,
  });

  final String id;
  final String name;
  final String email;
  final String? phone;
  final bool phoneVerified;
  final String role; // USER | HALL_MANAGER | ADMIN

  bool get isAdmin => role == 'ADMIN';
  bool get isManager => role == 'HALL_MANAGER' || role == 'ADMIN';

  factory User.fromJson(Map<String, dynamic> json) => User(
    id: _str(json['id']),
    name: _str(json['name']),
    email: _str(json['email']),
    phone: json['phone'] is String ? json['phone'] as String : null,
    phoneVerified: json['phoneVerified'] == true,
    role: _str(json['role'], 'USER'),
  );
}

class Movie {
  Movie({
    required this.id,
    required this.title,
    required this.slug,
    required this.synopsis,
    required this.language,
    required this.genre,
    required this.rating,
    required this.durationMin,
    required this.posterUrl,
    required this.backdropUrl,
    this.trailerUrl,
    required this.cast,
    this.releaseDate,
    this.shows = const [],
  });

  final String id;
  final String title;
  final String slug;
  final String synopsis;
  final String language;
  final String genre;
  final String rating;
  final int durationMin;
  final String posterUrl;
  final String backdropUrl;
  final String? trailerUrl;
  final List<String> cast;
  final DateTime? releaseDate;
  final List<Show> shows;

  factory Movie.fromJson(Map<String, dynamic> json) => Movie(
    id: _str(json['id']),
    title: _str(json['title']),
    slug: _str(json['slug']),
    synopsis: _str(json['synopsis']),
    language: _str(json['language']),
    genre: _str(json['genre']),
    rating: _str(json['rating']),
    durationMin: _int(json['durationMin']),
    posterUrl: _str(json['posterUrl']),
    backdropUrl: _str(json['backdropUrl']),
    trailerUrl: json['trailerUrl'] is String
        ? json['trailerUrl'] as String
        : null,
    cast: _strList(json['cast']),
    releaseDate: _date(json['releaseDate']),
    shows: json['shows'] is List
        ? (json['shows'] as List)
              .whereType<Map<String, dynamic>>()
              .map(Show.fromJson)
              .toList()
        : const [],
  );
}

class TheaterInfo {
  TheaterInfo({
    required this.id,
    required this.name,
    required this.city,
    required this.address,
    required this.chain,
  });

  final String id;
  final String name;
  final String city;
  final String address;
  final String chain;

  factory TheaterInfo.fromJson(Map<String, dynamic> json) => TheaterInfo(
    id: _str(json['id']),
    name: _str(json['name']),
    city: _str(json['city']),
    address: _str(json['address']),
    chain: _str(json['chain']),
  );
}

class Seat {
  Seat({
    required this.id,
    required this.row,
    required this.number,
    required this.type,
    required this.priceModifier,
    required this.price,
    required this.isReserved,
  });

  final String id;
  final String row;
  final int number;
  final String type;
  final int priceModifier;
  final int price;
  final bool isReserved;

  String get label => '$row$number';

  factory Seat.fromJson(Map<String, dynamic> json) => Seat(
    id: _str(json['id']),
    row: _str(json['row']),
    number: _int(json['number']),
    type: _str(json['type'], 'Standard'),
    priceModifier: _int(json['priceModifier']),
    price: _int(json['price']),
    isReserved: json['isReserved'] == true,
  );
}

class ScreenInfo {
  ScreenInfo({
    required this.id,
    required this.name,
    required this.type,
    required this.format,
    required this.equipment,
    this.theater,
    this.seats = const [],
    this.shows = const [],
  });

  final String id;
  final String name;
  final String type;
  final String format;
  final List<String> equipment;
  final TheaterInfo? theater;
  final List<Seat> seats;
  final List<Show> shows;

  factory ScreenInfo.fromJson(Map<String, dynamic> json) => ScreenInfo(
    id: _str(json['id']),
    name: _str(json['name']),
    type: _str(json['type'], 'Standard'),
    format: _str(json['format'], '2D'),
    equipment: _strList(json['equipment']),
    theater: json['theater'] is Map<String, dynamic>
        ? TheaterInfo.fromJson(json['theater'] as Map<String, dynamic>)
        : null,
    seats: json['seats'] is List
        ? (json['seats'] as List)
              .whereType<Map<String, dynamic>>()
              .map(Seat.fromJson)
              .toList()
        : const [],
    shows: json['shows'] is List
        ? (json['shows'] as List)
              .whereType<Map<String, dynamic>>()
              .map(Show.fromJson)
              .toList()
        : const [],
  );
}

class Show {
  Show({
    required this.id,
    this.startsAt,
    required this.basePrice,
    this.movie,
    this.screen,
  });

  final String id;
  final DateTime? startsAt;
  final int basePrice;
  final Movie? movie;
  final ScreenInfo? screen;

  factory Show.fromJson(Map<String, dynamic> json) => Show(
    id: _str(json['id']),
    startsAt: _date(json['startsAt']),
    basePrice: _int(json['basePrice']),
    movie: json['movie'] is Map<String, dynamic>
        ? Movie.fromJson(json['movie'] as Map<String, dynamic>)
        : null,
    screen: json['screen'] is Map<String, dynamic>
        ? ScreenInfo.fromJson(json['screen'] as Map<String, dynamic>)
        : null,
  );
}

class BookingSeatEntry {
  BookingSeatEntry({required this.label, required this.price});

  final String label;
  final int price;

  factory BookingSeatEntry.fromJson(Map<String, dynamic> json) {
    final seat = json['seat'];
    var label = '';
    if (seat is Map<String, dynamic>) {
      label = '${_str(seat['row'])}${_int(seat['number'])}';
    }
    return BookingSeatEntry(label: label, price: _int(json['price']));
  }
}

class Booking {
  Booking({
    required this.id,
    required this.status,
    required this.paymentStatus,
    required this.totalAmount,
    required this.confirmationCode,
    this.createdAt,
    this.show,
    this.seats = const [],
    this.userName,
    this.userEmail,
  });

  final String id;
  final String status; // PENDING | CONFIRMED | CANCELLED
  final String paymentStatus; // PENDING | SUCCEEDED | FAILED | REFUNDED
  final int totalAmount;
  final String confirmationCode;
  final DateTime? createdAt;
  final Show? show;
  final List<BookingSeatEntry> seats;
  final String? userName;
  final String? userEmail;

  bool get isPending => status == 'PENDING';

  String get seatLabels => seats.map((s) => s.label).join(', ');

  factory Booking.fromJson(Map<String, dynamic> json) {
    final user = json['user'];
    return Booking(
      id: _str(json['id']),
      status: _str(json['status'], 'PENDING'),
      paymentStatus: _str(json['paymentStatus'], 'PENDING'),
      totalAmount: _int(json['totalAmount']),
      confirmationCode: _str(json['confirmationCode']),
      createdAt: _date(json['createdAt']),
      show: json['show'] is Map<String, dynamic>
          ? Show.fromJson(json['show'] as Map<String, dynamic>)
          : null,
      seats: json['seats'] is List
          ? (json['seats'] as List)
                .whereType<Map<String, dynamic>>()
                .map(BookingSeatEntry.fromJson)
                .toList()
          : const [],
      userName: user is Map<String, dynamic> ? _str(user['name']) : null,
      userEmail: user is Map<String, dynamic> ? _str(user['email']) : null,
    );
  }
}

class MovieMeta {
  MovieMeta({
    this.cities = const [],
    this.chains = const [],
    this.genres = const [],
    this.languages = const [],
    this.ratings = const [],
    this.screenTypes = const [],
    this.formats = const [],
  });

  final List<String> cities;
  final List<String> chains;
  final List<String> genres;
  final List<String> languages;
  final List<String> ratings;
  final List<String> screenTypes;
  final List<String> formats;

  factory MovieMeta.fromJson(Map<String, dynamic> json) => MovieMeta(
    cities: _strList(json['cities']),
    chains: _strList(json['chains']),
    genres: _strList(json['genres']),
    languages: _strList(json['languages']),
    ratings: _strList(json['ratings']),
    screenTypes: _strList(json['screenTypes']),
    formats: _strList(json['formats']),
  );
}

class Recommendation {
  Recommendation({
    required this.movieId,
    required this.title,
    required this.reason,
  });

  final String movieId;
  final String title;
  final String reason;

  factory Recommendation.fromJson(Map<String, dynamic> json) => Recommendation(
    movieId: _str(json['movieId']),
    title: _str(json['title']),
    reason: _str(json['reason']),
  );
}

class AdminSummary {
  AdminSummary({
    required this.users,
    required this.movies,
    required this.shows,
    required this.bookings,
    required this.revenue,
  });

  final int users;
  final int movies;
  final int shows;
  final int bookings;
  final int revenue;

  factory AdminSummary.fromJson(Map<String, dynamic> json) => AdminSummary(
    users: _int(json['users']),
    movies: _int(json['movies']),
    shows: _int(json['shows']),
    bookings: _int(json['bookings']),
    revenue: _int(json['revenue']),
  );
}

class CatalogMovie {
  CatalogMovie({required this.id, required this.title, required this.slug});

  final String id;
  final String title;
  final String slug;

  factory CatalogMovie.fromJson(Map<String, dynamic> json) => CatalogMovie(
    id: _str(json['id']),
    title: _str(json['title']),
    slug: _str(json['slug']),
  );
}

class CatalogScreen {
  CatalogScreen({required this.id, required this.name, required this.label});

  final String id;
  final String name;
  final String label;

  factory CatalogScreen.fromJson(Map<String, dynamic> json) {
    final theater = json['theater'];
    var label = _str(json['name']);
    if (theater is Map<String, dynamic>) {
      label =
          '${_str(theater['city'])} • ${_str(theater['name'])} • ${_str(json['name'])}';
    }
    return CatalogScreen(
      id: _str(json['id']),
      name: _str(json['name']),
      label: label,
    );
  }
}
