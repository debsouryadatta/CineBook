import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/auth_state.dart';
import '../core/config.dart';
import '../core/nav.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../widgets/common.dart';
import 'login_screen.dart';

class MovieScreen extends StatefulWidget {
  const MovieScreen({super.key, required this.slug});

  final String slug;

  @override
  State<MovieScreen> createState() => _MovieScreenState();
}

class _MovieScreenState extends State<MovieScreen> {
  final _api = ApiClient.instance;

  Movie? _movie;
  Show? _show; // currently selected show, with seat inventory
  String? _selectedShowId;
  final Set<String> _selectedSeatIds = {};

  bool _loadingMovie = true;
  bool _loadingShow = false;
  bool _booking = false;
  String? _error;
  Timer? _seatPoll;

  @override
  void initState() {
    super.initState();
    _loadMovie();
    // Live seat availability, mirroring the web app's 5s refresh.
    _seatPoll = Timer.periodic(const Duration(seconds: 5), (_) {
      if (_selectedShowId != null && !_booking && !_loadingShow) {
        _loadShow(_selectedShowId!, silent: true);
      }
    });
  }

  @override
  void dispose() {
    _seatPoll?.cancel();
    super.dispose();
  }

  List<Show> get _shows {
    final shows =
        _movie?.shows
            .where((s) => s.startsAt != null && s.screen != null)
            .toList() ??
        [];
    shows.sort((a, b) => a.startsAt!.compareTo(b.startsAt!));
    return shows;
  }

  List<Seat> get _seats {
    final seats = List<Seat>.of(_show?.screen?.seats ?? const []);
    seats.sort((a, b) {
      final byRow = a.row.compareTo(b.row);
      return byRow != 0 ? byRow : a.number.compareTo(b.number);
    });
    return seats;
  }

  List<Seat> get _selectedSeats =>
      _seats.where((s) => _selectedSeatIds.contains(s.id)).toList();

  int get _total => _selectedSeats.fold(0, (sum, s) => sum + s.price);

  Future<void> _loadMovie() async {
    setState(() {
      _loadingMovie = true;
      _error = null;
    });
    try {
      final data = await _api.get('/movies/${widget.slug}');
      if (!mounted) return;
      final movie = Movie.fromJson(
        (data['movie'] as Map).cast<String, dynamic>(),
      );
      setState(() {
        _movie = movie;
        _loadingMovie = false;
      });
      final shows = _shows;
      if (shows.isNotEmpty) _selectShow(shows.first.id);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loadingMovie = false;
      });
    }
  }

  void _selectShow(String showId) {
    if (_selectedShowId == showId) return;
    setState(() {
      _selectedShowId = showId;
      _selectedSeatIds.clear();
      _show = null;
    });
    _loadShow(showId);
  }

  Future<void> _loadShow(String showId, {bool silent = false}) async {
    if (!silent) setState(() => _loadingShow = true);
    try {
      final data = await _api.get('/shows/$showId');
      if (!mounted || _selectedShowId != showId) return;
      final show = Show.fromJson((data['show'] as Map).cast<String, dynamic>());
      final reserved = {
        for (final seat in show.screen?.seats ?? const <Seat>[])
          if (seat.isReserved) seat.id,
      };
      final taken = _selectedSeatIds.where(reserved.contains).toList();
      setState(() {
        _show = show;
        _loadingShow = false;
        _selectedSeatIds.removeAll(taken);
      });
      if (taken.isNotEmpty && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Some of your selected seats were just taken by others.',
            ),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingShow = false);
      if (!silent) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  void _toggleSeat(Seat seat) {
    if (seat.isReserved) return;
    setState(() {
      if (_selectedSeatIds.contains(seat.id)) {
        _selectedSeatIds.remove(seat.id);
      } else if (_selectedSeatIds.length >= 8) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('You can book at most 8 seats at once.'),
          ),
        );
      } else {
        _selectedSeatIds.add(seat.id);
      }
    });
  }

  void _pickBestSeats() {
    final available = _seats.where((s) => !s.isReserved).take(2).toList();
    if (available.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No seats left for this show.')),
      );
      return;
    }
    setState(() {
      _selectedSeatIds
        ..clear()
        ..addAll(available.map((s) => s.id));
    });
  }

  Future<void> _bookSeats() async {
    final auth = context.read<AuthState>();
    if (auth.user == null) {
      final ok = await Navigator.of(
        context,
      ).push<bool>(MaterialPageRoute(builder: (_) => const LoginScreen()));
      if (ok != true || !mounted) return;
    }
    if (_selectedSeatIds.isEmpty || _selectedShowId == null) return;

    setState(() => _booking = true);
    try {
      final seatIds = _selectedSeatIds.toList();
      final holdData = await _api.post('/holds', {
        'showId': _selectedShowId,
        'seatIds': seatIds,
      });
      final holdIds = ((holdData['holds'] as List?) ?? [])
          .whereType<Map>()
          .map((h) => h['id'] as String?)
          .whereType<String>()
          .toList();

      final bookingData = await _api.post('/bookings', {
        'showId': _selectedShowId,
        'seatIds': seatIds,
        'holdIds': holdIds,
      });
      final booking = Booking.fromJson(
        (bookingData['booking'] as Map).cast<String, dynamic>(),
      );

      if (!mounted) return;
      // Seats are now held/booked by us; clear selection so the live seat
      // refresh doesn't treat them as "taken by others".
      setState(() {
        _booking = false;
        _selectedSeatIds.clear();
      });
      await _openPaymentSheet(booking);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _booking = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
      if (e.statusCode == 409 && _selectedShowId != null) {
        _loadShow(_selectedShowId!, silent: true);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _booking = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _openPaymentSheet(Booking booking) async {
    // Returns the transaction id on success, null when dismissed unpaid.
    final txn = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _PaymentSheet(booking: booking),
    );
    if (!mounted) return;
    if (_selectedShowId != null) _loadShow(_selectedShowId!, silent: true);
    if (txn != null) {
      _showPaymentSuccess(booking, txn);
    } else {
      // Booking stays PENDING; seats may free up after the hold expires.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Booking is pending payment. You can finish it from Tickets.',
          ),
        ),
      );
    }
  }

  void _showPaymentSuccess(Booking booking, String txn) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: AppColors.success, size: 26),
            SizedBox(width: 8),
            Expanded(child: Text('Payment successful')),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Your seats are locked in. Confirmation ${booking.confirmationCode}.',
              style: const TextStyle(fontSize: 14, height: 1.45),
            ),
            if (txn.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                'Transaction $txn',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.mutedForeground,
                ),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Close'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              Navigator.of(context).popUntil((r) => r.isFirst);
              rootTabIndex.value = ticketsTab;
            },
            child: const Text('View tickets'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingMovie) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_movie == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Movie')),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: ErrorBanner(_error ?? 'Movie not found'),
        ),
      );
    }

    final movie = _movie!;
    final shows = _shows;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          _buildHero(movie),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 22, 16, 0),
            sliver: SliverToBoxAdapter(
              child: SectionHeader(
                title: 'Choose a screen',
                subtitle: shows.isEmpty
                    ? null
                    : '${shows.length} upcoming showtime${shows.length == 1 ? '' : 's'}',
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: shows.isEmpty
                ? const Padding(
                    padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
                    child: EmptyState(
                      icon: Icons.event_busy_outlined,
                      title: 'No upcoming shows',
                      message: 'Check back soon — new showtimes drop daily.',
                    ),
                  )
                : SizedBox(
                    height: 96,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                      scrollDirection: Axis.horizontal,
                      itemCount: shows.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 10),
                      itemBuilder: (context, i) => _showtimeCard(shows[i]),
                    ),
                  ),
          ),
          if (shows.isNotEmpty) ...[
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 26, 16, 0),
              sliver: SliverToBoxAdapter(
                child: SectionHeader(
                  title: 'Select seats',
                  subtitle:
                      'Screen is at the top. Reserved seats are unavailable.',
                  trailing: OutlinedButton.icon(
                    onPressed: _seats.isEmpty ? null : _pickBestSeats,
                    icon: const Icon(Icons.auto_awesome, size: 16),
                    label: const Text('Best seats'),
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 130),
              sliver: SliverToBoxAdapter(
                child: _loadingShow
                    ? const Padding(
                        padding: EdgeInsets.symmetric(vertical: 50),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    : _SeatMap(
                        seats: _seats,
                        selectedIds: _selectedSeatIds,
                        onTap: _toggleSeat,
                      ),
              ),
            ),
          ] else
            const SliverPadding(padding: EdgeInsets.only(bottom: 60)),
        ],
      ),
      bottomNavigationBar: shows.isEmpty ? null : _buildBottomBar(),
    );
  }

  SliverAppBar _buildHero(Movie movie) {
    return SliverAppBar(
      expandedHeight: 330,
      pinned: true,
      backgroundColor: AppColors.inkDeep,
      foregroundColor: Colors.white,
      leading: Padding(
        padding: const EdgeInsets.all(6),
        child: CircleAvatar(
          backgroundColor: AppColors.inkDeep.withValues(alpha: 0.55),
          child: BackButton(color: Colors.white),
        ),
      ),
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
          fit: StackFit.expand,
          children: [
            Opacity(opacity: 0.5, child: PosterImage(movie.backdropUrl)),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppColors.inkDeep.withValues(alpha: 0.25),
                    AppColors.inkDeep.withValues(alpha: 0.95),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 18,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  SizedBox(
                    width: 92,
                    height: 132,
                    child: PosterImage(
                      movie.posterUrl,
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            Pill(
                              movie.genre,
                              color: AppColors.accent,
                              textColor: AppColors.inkDeep,
                            ),
                            Pill(
                              movie.rating,
                              color: const Color(0x33FFFFFF),
                              textColor: Colors.white,
                            ),
                            Pill(
                              '${movie.durationMin} min',
                              color: const Color(0x33FFFFFF),
                              textColor: Colors.white,
                            ),
                            Pill(
                              movie.language,
                              color: const Color(0x33FFFFFF),
                              textColor: Colors.white,
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          movie.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 23,
                            fontWeight: FontWeight.w900,
                            height: 1.1,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          movie.synopsis,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.78),
                            fontSize: 12.5,
                            height: 1.4,
                          ),
                        ),
                        if (movie.cast.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            movie.cast.take(4).join('  •  '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.6),
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _showtimeCard(Show show) {
    final selected = show.id == _selectedShowId;
    final theater = show.screen?.theater;
    return GestureDetector(
      onTap: () => _selectShow(show.id),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 210,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? AppColors.surface : AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.accent : AppColors.border,
            width: selected ? 1.8 : 0.8,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: AppColors.accent.withValues(alpha: 0.25),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              formatShowTime(show.startsAt),
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 5),
            Row(
              children: [
                const Icon(
                  Icons.location_on_outlined,
                  size: 13,
                  color: AppColors.mutedForeground,
                ),
                const SizedBox(width: 3),
                Expanded(
                  child: Text(
                    theater == null ? '—' : '${theater.name}, ${theater.city}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                ),
              ],
            ),
            const Spacer(),
            Row(
              children: [
                Pill(
                  '${show.screen?.name ?? ''} • ${show.screen?.format ?? ''}',
                  color: selected ? AppColors.accent : AppColors.muted,
                  textColor: AppColors.inkDeep,
                ),
                const Spacer(),
                Text(
                  'from ${formatMoney(show.basePrice)}',
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomBar() {
    final seats = _selectedSeats;
    final labels = seats.map((s) => s.label).join(', ');
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border, width: 0.8)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      seats.isEmpty
                          ? 'No seats selected'
                          : '${seats.length} seat${seats.length == 1 ? '' : 's'} • ${formatMoney(_total)}',
                      style: const TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      seats.isEmpty ? 'Tap seats on the map above.' : labels,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: seats.isEmpty || _booking ? null : _bookSeats,
                icon: _booking
                    ? const SizedBox(
                        width: 17,
                        height: 17,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.3,
                          color: AppColors.inkDeep,
                        ),
                      )
                    : const Icon(Icons.local_activity_outlined, size: 19),
                label: Text(_booking ? 'Booking…' : 'Book seats'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SeatMap extends StatelessWidget {
  const _SeatMap({
    required this.seats,
    required this.selectedIds,
    required this.onTap,
  });

  final List<Seat> seats;
  final Set<String> selectedIds;
  final void Function(Seat) onTap;

  @override
  Widget build(BuildContext context) {
    if (seats.isEmpty) {
      return const EmptyState(
        icon: Icons.chair_alt_outlined,
        title: 'Pick a showtime to load seats',
      );
    }

    final rows = <String, List<Seat>>{};
    for (final seat in seats) {
      rows.putIfAbsent(seat.row, () => []).add(seat);
    }
    final rowKeys = rows.keys.toList()..sort();

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Column(
        children: [
          // Screen indicator
          Container(
            height: 7,
            margin: const EdgeInsets.symmetric(horizontal: 30),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              gradient: LinearGradient(
                colors: [
                  AppColors.accent.withValues(alpha: 0.15),
                  AppColors.accent,
                  AppColors.accent.withValues(alpha: 0.15),
                ],
              ),
            ),
          ),
          const SizedBox(height: 5),
          const Text(
            'SCREEN',
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 3,
              fontWeight: FontWeight.w800,
              color: AppColors.mutedForeground,
            ),
          ),
          const SizedBox(height: 14),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final row in rowKeys)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 22,
                          child: Text(
                            row,
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800,
                              color: AppColors.mutedForeground,
                            ),
                          ),
                        ),
                        for (final seat in rows[row]!) _seatBox(seat),
                        const SizedBox(width: 4),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 16,
            runSpacing: 6,
            alignment: WrapAlignment.center,
            children: const [
              _LegendDot(
                color: AppColors.surface,
                label: 'Available',
                bordered: true,
              ),
              _LegendDot(color: AppColors.accent, label: 'Selected'),
              _LegendDot(color: AppColors.reservedSeat, label: 'Reserved'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _seatBox(Seat seat) {
    final selected = selectedIds.contains(seat.id);
    final Color bg;
    final Color fg;
    Border? border;
    if (seat.isReserved) {
      bg = AppColors.reservedSeat;
      fg = AppColors.reservedSeatText;
    } else if (selected) {
      bg = AppColors.accent;
      fg = AppColors.inkDeep;
    } else {
      bg = AppColors.surface;
      fg = AppColors.ink;
      border = Border.all(color: AppColors.border);
    }
    return GestureDetector(
      onTap: () => onTap(seat),
      child: Container(
        width: 34,
        height: 34,
        margin: const EdgeInsets.symmetric(horizontal: 3),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(9),
            topRight: Radius.circular(9),
            bottomLeft: Radius.circular(4),
            bottomRight: Radius.circular(4),
          ),
          border: border,
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: AppColors.accent.withValues(alpha: 0.4),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Text(
          '${seat.number}',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: fg,
          ),
        ),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({
    required this.color,
    required this.label,
    this.bordered = false,
  });

  final Color color;
  final String label;
  final bool bordered;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 13,
          height: 13,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
            border: bordered ? Border.all(color: AppColors.border) : null,
          ),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11.5,
            color: AppColors.mutedForeground,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _PaymentSheet extends StatefulWidget {
  const _PaymentSheet({required this.booking});

  final Booking booking;

  @override
  State<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<_PaymentSheet> {
  final _card = TextEditingController(text: AppConfig.defaultTestCard);
  bool _paying = false;
  String? _error;

  @override
  void dispose() {
    _card.dispose();
    super.dispose();
  }

  Future<void> _pay() async {
    if (_card.text.trim().length < 12) {
      setState(() => _error = 'Card number must be at least 12 digits.');
      return;
    }
    setState(() {
      _paying = true;
      _error = null;
    });
    try {
      final data = await ApiClient.instance.post('/payments/process', {
        'bookingId': widget.booking.id,
        'cardNumber': _card.text.trim(),
      });
      if (!mounted) return;
      final txn = (data['payment'] is Map)
          ? (data['payment']['transactionId'] as String? ?? '')
          : '';
      Navigator.of(context).pop(txn);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _paying = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _paying = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final booking = widget.booking;
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Complete payment',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
                ),
              ),
              IconButton(
                onPressed: _paying ? null : () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Simulated payment for ${booking.confirmationCode}',
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.mutedForeground,
            ),
          ),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border, width: 0.8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${booking.seats.length} seat${booking.seats.length == 1 ? '' : 's'}: ${booking.seatLabels}',
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  formatMoney(booking.totalAmount),
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Card number',
            style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _card,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              hintText: '4242 4242 4242 4242',
              prefixIcon: Icon(Icons.credit_card, size: 20),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Test cards — Success: 4242424242424242 · Failure: 4000000000000002 · '
            'Random: any card ending 3000.',
            style: TextStyle(fontSize: 11.5, color: AppColors.mutedForeground),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            ErrorBanner(_error!),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _paying ? null : _pay,
              icon: _paying
                  ? const SizedBox(
                      width: 17,
                      height: 17,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.3,
                        color: AppColors.inkDeep,
                      ),
                    )
                  : const Icon(Icons.lock_outline, size: 18),
              label: Text(
                _paying
                    ? 'Processing…'
                    : 'Pay ${formatMoney(booking.totalAmount)}',
              ),
            ),
          ),
        ],
      ),
    );
  }
}
