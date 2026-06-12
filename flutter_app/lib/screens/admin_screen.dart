import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../widgets/common.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  final _api = ApiClient.instance;

  AdminSummary? _summary;
  List<CatalogMovie> _catalogMovies = [];
  List<CatalogScreen> _catalogScreens = [];
  List<Booking> _bookings = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _api.get('/admin/summary'),
        _api.get('/admin/catalog'),
        _api.get('/admin/bookings'),
      ]);
      if (!mounted) return;
      setState(() {
        _summary = AdminSummary.fromJson(
          (results[0] as Map).cast<String, dynamic>(),
        );
        _catalogMovies = ((results[1]['movies'] as List?) ?? [])
            .whereType<Map<String, dynamic>>()
            .map(CatalogMovie.fromJson)
            .toList();
        _catalogScreens = ((results[1]['screens'] as List?) ?? [])
            .whereType<Map<String, dynamic>>()
            .map(CatalogScreen.fromJson)
            .toList();
        _bookings = ((results[2]['bookings'] as List?) ?? [])
            .whereType<Map<String, dynamic>>()
            .map(Booking.fromJson)
            .toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Admin console')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  if (_error != null) ...[
                    ErrorBanner(_error!),
                    const SizedBox(height: 12),
                  ],
                  const SectionHeader(
                    title: 'Operations summary',
                    subtitle:
                        'Catalog, scheduling, revenue, and booking activity.',
                  ),
                  const SizedBox(height: 12),
                  if (_summary != null) _summaryGrid(_summary!),
                  const SizedBox(height: 24),
                  const SectionHeader(
                    title: 'Add a movie',
                    subtitle: 'New titles appear in the catalog instantly.',
                  ),
                  const SizedBox(height: 12),
                  _AddMovieForm(onSaved: _load),
                  const SizedBox(height: 24),
                  const SectionHeader(
                    title: 'Create a showtime',
                    subtitle: 'Schedule any screen across all theaters.',
                  ),
                  const SizedBox(height: 12),
                  _CreateShowForm(
                    movies: _catalogMovies,
                    screens: _catalogScreens,
                    onSaved: _load,
                  ),
                  const SizedBox(height: 24),
                  const SectionHeader(
                    title: 'Recent bookings',
                    subtitle: 'Latest 12 across all users.',
                  ),
                  const SizedBox(height: 12),
                  if (_bookings.isEmpty)
                    const EmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: 'No bookings yet',
                    )
                  else
                    for (final b in _bookings) ...[
                      _bookingRow(b),
                      const SizedBox(height: 8),
                    ],
                ],
              ),
            ),
    );
  }

  Widget _summaryGrid(AdminSummary s) {
    final items = [
      (Icons.people_outline, '${s.users}', 'Users'),
      (Icons.movie_outlined, '${s.movies}', 'Movies'),
      (Icons.calendar_month_outlined, '${s.shows}', 'Shows'),
      (Icons.local_activity_outlined, '${s.bookings}', 'Bookings'),
      (Icons.payments_outlined, formatMoney(s.revenue), 'Revenue'),
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.85,
      ),
      itemCount: items.length,
      itemBuilder: (context, i) {
        final (icon, value, label) = items[i];
        return Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border, width: 0.8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                children: [
                  Icon(icon, size: 16, color: AppColors.mutedForeground),
                  const SizedBox(width: 6),
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  value,
                  style: const TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _bookingRow(Booking b) {
    final statusColor = bookingStatusColor(b.status);
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Pill(b.confirmationCode),
              const Spacer(),
              Pill(
                b.status,
                color: statusColor.withValues(alpha: 0.14),
                textColor: statusColor,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            b.show?.movie?.title ?? 'Movie',
            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 3),
          Text(
            '${b.userEmail ?? '—'} · ${formatShowTime(b.show?.startsAt)}',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.mutedForeground,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Seats: ${b.seatLabels.isEmpty ? '—' : b.seatLabels}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.mutedForeground,
                  ),
                ),
              ),
              Text(
                formatMoney(b.totalAmount),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

String _toSlug(String value) => value
    .toLowerCase()
    .trim()
    .replaceAll(RegExp(r'[^a-z0-9\s-]'), '')
    .replaceAll(RegExp(r'[\s-]+'), '-')
    .replaceAll(RegExp(r'^-+|-+$'), '');

class _AddMovieForm extends StatefulWidget {
  const _AddMovieForm({required this.onSaved});

  final VoidCallback onSaved;

  @override
  State<_AddMovieForm> createState() => _AddMovieFormState();
}

class _AddMovieFormState extends State<_AddMovieForm> {
  final _title = TextEditingController();
  final _slug = TextEditingController();
  final _language = TextEditingController();
  final _genre = TextEditingController();
  final _rating = TextEditingController();
  final _duration = TextEditingController(text: '120');
  final _cast = TextEditingController();
  final _synopsis = TextEditingController();
  final _posterUrl = TextEditingController();
  final _backdropUrl = TextEditingController();
  DateTime _releaseDate = DateTime.now();
  bool _slugEdited = false;
  bool _submitting = false;
  String? _message;
  bool _messageIsError = false;

  @override
  void initState() {
    super.initState();
    _title.addListener(() {
      if (!_slugEdited) _slug.text = _toSlug(_title.text);
    });
  }

  @override
  void dispose() {
    for (final c in [
      _title,
      _slug,
      _language,
      _genre,
      _rating,
      _duration,
      _cast,
      _synopsis,
      _posterUrl,
      _backdropUrl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final duration = int.tryParse(_duration.text.trim());
    if (_title.text.trim().isEmpty ||
        _slug.text.trim().isEmpty ||
        _synopsis.text.trim().isEmpty ||
        _language.text.trim().isEmpty ||
        _genre.text.trim().isEmpty ||
        _rating.text.trim().isEmpty ||
        _posterUrl.text.trim().isEmpty ||
        _backdropUrl.text.trim().isEmpty ||
        duration == null ||
        duration <= 0) {
      setState(() {
        _message = 'Fill every field; duration must be a positive number.';
        _messageIsError = true;
      });
      return;
    }
    setState(() {
      _submitting = true;
      _message = null;
    });
    try {
      await ApiClient.instance.post('/admin/movies', {
        'title': _title.text.trim(),
        'slug': _slug.text.trim(),
        'synopsis': _synopsis.text.trim(),
        'language': _language.text.trim(),
        'genre': _genre.text.trim(),
        'rating': _rating.text.trim(),
        'durationMin': duration,
        'posterUrl': _posterUrl.text.trim(),
        'backdropUrl': _backdropUrl.text.trim(),
        'cast': _cast.text
            .split(',')
            .map((s) => s.trim())
            .where((s) => s.isNotEmpty)
            .toList(),
        'releaseDate': _releaseDate.toUtc().toIso8601String(),
      });
      if (!mounted) return;
      setState(() {
        _message = 'Movie "${_title.text.trim()}" added to the catalog.';
        _messageIsError = false;
        _submitting = false;
        _slugEdited = false;
      });
      for (final c in [
        _title,
        _slug,
        _language,
        _genre,
        _rating,
        _cast,
        _synopsis,
        _posterUrl,
        _backdropUrl,
      ]) {
        c.clear();
      }
      _duration.text = '120';
      widget.onSaved();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _messageIsError = true;
        _submitting = false;
      });
    }
  }

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6, top: 12),
    child: Text(
      text,
      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _label('Title'),
          TextField(
            controller: _title,
            decoration: const InputDecoration(hintText: 'Movie title'),
          ),
          _label('Slug'),
          TextField(
            controller: _slug,
            onChanged: (_) => _slugEdited = true,
            decoration: const InputDecoration(hintText: 'auto-generated-slug'),
          ),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _label('Language'),
                    TextField(
                      controller: _language,
                      decoration: const InputDecoration(hintText: 'English'),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _label('Genre'),
                    TextField(
                      controller: _genre,
                      decoration: const InputDecoration(hintText: 'Sci-fi'),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _label('Age rating'),
                    TextField(
                      controller: _rating,
                      decoration: const InputDecoration(hintText: 'U/A'),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _label('Duration (min)'),
                    TextField(
                      controller: _duration,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(hintText: '120'),
                    ),
                  ],
                ),
              ),
            ],
          ),
          _label('Release date'),
          OutlinedButton.icon(
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: _releaseDate,
                firstDate: DateTime(2000),
                lastDate: DateTime(2035),
              );
              if (picked != null) setState(() => _releaseDate = picked);
            },
            icon: const Icon(Icons.event, size: 17),
            label: Text(
              DateFormat('d MMM yyyy').format(_releaseDate),
              style: const TextStyle(fontSize: 13.5),
            ),
          ),
          _label('Cast (comma separated)'),
          TextField(
            controller: _cast,
            decoration: const InputDecoration(hintText: 'Actor One, Actor Two'),
          ),
          _label('Synopsis'),
          TextField(
            controller: _synopsis,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'A short, vivid synopsis…',
            ),
          ),
          _label('Poster URL'),
          TextField(
            controller: _posterUrl,
            decoration: const InputDecoration(hintText: 'https://…'),
          ),
          _label('Backdrop URL'),
          TextField(
            controller: _backdropUrl,
            decoration: const InputDecoration(hintText: 'https://…'),
          ),
          if (_message != null) ...[
            const SizedBox(height: 12),
            _messageIsError
                ? ErrorBanner(_message!)
                : _SuccessBanner(_message!),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(
                      width: 17,
                      height: 17,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.3,
                        color: AppColors.inkDeep,
                      ),
                    )
                  : const Icon(Icons.add, size: 18),
              label: Text(_submitting ? 'Adding…' : 'Add movie'),
            ),
          ),
        ],
      ),
    );
  }
}

class _CreateShowForm extends StatefulWidget {
  const _CreateShowForm({
    required this.movies,
    required this.screens,
    required this.onSaved,
  });

  final List<CatalogMovie> movies;
  final List<CatalogScreen> screens;
  final VoidCallback onSaved;

  @override
  State<_CreateShowForm> createState() => _CreateShowFormState();
}

class _CreateShowFormState extends State<_CreateShowForm> {
  String? _movieId;
  String? _screenId;
  DateTime _startsAt = DateTime.now().add(const Duration(days: 1));
  final _price = TextEditingController(text: '260');
  bool _submitting = false;
  String? _message;
  bool _messageIsError = false;

  @override
  void initState() {
    super.initState();
    _startsAt = DateTime(_startsAt.year, _startsAt.month, _startsAt.day, 18, 0);
  }

  @override
  void dispose() {
    _price.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_movieId == null || _screenId == null) {
      setState(() {
        _message = 'Pick a movie and a screen first.';
        _messageIsError = true;
      });
      return;
    }
    if (!_startsAt.isAfter(DateTime.now())) {
      setState(() {
        _message = 'Showtime must be in the future.';
        _messageIsError = true;
      });
      return;
    }
    final price = int.tryParse(_price.text.trim());
    if (price == null || price <= 0) {
      setState(() {
        _message = 'Base price must be a positive number.';
        _messageIsError = true;
      });
      return;
    }
    setState(() {
      _submitting = true;
      _message = null;
    });
    try {
      await ApiClient.instance.post('/admin/shows', {
        'movieId': _movieId,
        'screenId': _screenId,
        'startsAt': _startsAt.toUtc().toIso8601String(),
        'basePrice': price,
      });
      if (!mounted) return;
      setState(() {
        _message = 'Show scheduled for ${formatShowTime(_startsAt)}.';
        _messageIsError = false;
        _submitting = false;
      });
      widget.onSaved();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _messageIsError = true;
        _submitting = false;
      });
    }
  }

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6, top: 12),
    child: Text(
      text,
      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _label('Movie'),
          DropdownButtonFormField<String>(
            initialValue: _movieId,
            isExpanded: true,
            hint: const Text('Pick a movie', style: TextStyle(fontSize: 14)),
            items: [
              for (final m in widget.movies)
                DropdownMenuItem(
                  value: m.id,
                  child: Text(m.title, overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (v) => setState(() => _movieId = v),
          ),
          _label('Screen'),
          DropdownButtonFormField<String>(
            initialValue: _screenId,
            isExpanded: true,
            hint: const Text('Pick a screen', style: TextStyle(fontSize: 14)),
            items: [
              for (final s in widget.screens)
                DropdownMenuItem(
                  value: s.id,
                  child: Text(
                    s.label,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13.5),
                  ),
                ),
            ],
            onChanged: (v) => setState(() => _screenId = v),
          ),
          _label('Starts at'),
          OutlinedButton.icon(
            onPressed: () async {
              final now = DateTime.now();
              final date = await showDatePicker(
                context: context,
                initialDate: _startsAt.isAfter(now) ? _startsAt : now,
                firstDate: now,
                lastDate: now.add(const Duration(days: 30)),
              );
              if (date == null || !mounted) return;
              if (!context.mounted) return;
              final time = await showTimePicker(
                context: context,
                initialTime: TimeOfDay.fromDateTime(_startsAt),
              );
              if (time == null) return;
              setState(
                () => _startsAt = DateTime(
                  date.year,
                  date.month,
                  date.day,
                  time.hour,
                  time.minute,
                ),
              );
            },
            icon: const Icon(Icons.event, size: 17),
            label: Text(
              DateFormat('EEE, d MMM yyyy • h:mm a').format(_startsAt),
              style: const TextStyle(fontSize: 13.5),
            ),
          ),
          _label('Base price (₹)'),
          TextField(
            controller: _price,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(hintText: '260'),
          ),
          if (_message != null) ...[
            const SizedBox(height: 12),
            _messageIsError
                ? ErrorBanner(_message!)
                : _SuccessBanner(_message!),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed:
                  _submitting || widget.movies.isEmpty || widget.screens.isEmpty
                  ? null
                  : _submit,
              icon: _submitting
                  ? const SizedBox(
                      width: 17,
                      height: 17,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.3,
                        color: AppColors.inkDeep,
                      ),
                    )
                  : const Icon(Icons.event_available, size: 18),
              label: Text(_submitting ? 'Scheduling…' : 'Schedule show'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SuccessBanner extends StatelessWidget {
  const _SuccessBanner(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.4)),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: AppColors.success,
          fontSize: 13.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
