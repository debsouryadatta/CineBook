import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../widgets/common.dart';

class ManagerScreen extends StatefulWidget {
  const ManagerScreen({super.key});

  @override
  State<ManagerScreen> createState() => _ManagerScreenState();
}

class _ManagerScreenState extends State<ManagerScreen> {
  final _api = ApiClient.instance;

  List<ScreenInfo> _screens = [];
  List<Movie> _movies = [];
  bool _loading = true;
  String? _error;

  // Schedule form
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
    _load();
  }

  @override
  void dispose() {
    _price.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _api.get('/manager/screens'),
        _api.get('/movies'),
      ]);
      if (!mounted) return;
      setState(() {
        _screens = ((results[0]['screens'] as List?) ?? [])
            .whereType<Map<String, dynamic>>()
            .map(ScreenInfo.fromJson)
            .toList();
        _movies = ((results[1]['movies'] as List?) ?? [])
            .whereType<Map<String, dynamic>>()
            .map(Movie.fromJson)
            .toList();
        _movieId ??= _movies.isNotEmpty ? _movies.first.id : null;
        _screenId ??= _screens.isNotEmpty ? _screens.first.id : null;
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

  int get _upcomingShows => _screens.fold(0, (sum, s) => sum + s.shows.length);

  Future<void> _pickStartsAt() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _startsAt.isAfter(now) ? _startsAt : now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 30)),
    );
    if (date == null || !mounted) return;
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
  }

  Future<void> _schedule() async {
    if (_movieId == null || _screenId == null) return;
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
      await _api.post('/manager/shows', {
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
      _load();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _messageIsError = true;
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manager console')),
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
                  Row(
                    children: [
                      Expanded(
                        child: _statCard(
                          Icons.monitor_outlined,
                          '${_screens.length}',
                          'Assigned screens',
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _statCard(
                          Icons.table_rows_outlined,
                          '$_upcomingShows',
                          'Upcoming shows',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  const SectionHeader(
                    title: 'Schedule show',
                    subtitle: 'Only screens assigned by an admin appear here.',
                  ),
                  const SizedBox(height: 12),
                  _scheduleForm(),
                  const SizedBox(height: 24),
                  const SectionHeader(title: 'Assigned screens'),
                  const SizedBox(height: 12),
                  if (_screens.isEmpty)
                    const EmptyState(
                      icon: Icons.monitor_outlined,
                      title: 'No screens assigned yet',
                      message: 'Ask an admin to assign screens to you.',
                    )
                  else
                    for (final screen in _screens) ...[
                      _screenCard(screen),
                      const SizedBox(height: 10),
                    ],
                ],
              ),
            ),
    );
  }

  Widget _statCard(IconData icon, String value, String label) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: AppColors.mutedForeground),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.mutedForeground,
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6, top: 12),
    child: Text(
      text,
      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
    ),
  );

  Widget _scheduleForm() {
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
            items: [
              for (final m in _movies)
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
            items: [
              for (final s in _screens)
                DropdownMenuItem(
                  value: s.id,
                  child: Text(
                    '${s.theater?.city ?? ''} • ${s.theater?.name ?? ''} • ${s.name}',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13.5),
                  ),
                ),
            ],
            onChanged: (v) => setState(() => _screenId = v),
          ),
          _label('Starts at'),
          OutlinedButton.icon(
            onPressed: _pickStartsAt,
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
                : Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.success.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Text(
                      _message!,
                      style: const TextStyle(
                        color: AppColors.success,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _submitting || _movies.isEmpty || _screens.isEmpty
                  ? null
                  : _schedule,
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

  Widget _screenCard(ScreenInfo screen) {
    final next = screen.shows.isNotEmpty ? screen.shows.first : null;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if ((screen.theater?.chain ?? '').isNotEmpty)
                Pill(
                  screen.theater!.chain,
                  color: AppColors.inkDeep,
                  textColor: Colors.white,
                ),
              const Spacer(),
              const Icon(
                Icons.videocam_outlined,
                size: 19,
                color: AppColors.mutedForeground,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '${screen.theater?.name ?? 'Theater'} — ${screen.name}',
            style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800),
          ),
          Text(
            screen.theater?.city ?? '',
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.mutedForeground,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              Pill(screen.type),
              Pill(screen.format),
              Pill(
                '${screen.shows.length} upcoming',
                color: AppColors.accent.withValues(alpha: 0.2),
              ),
            ],
          ),
          if (next?.movie != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(
                  Icons.play_circle_outline,
                  size: 15,
                  color: AppColors.mutedForeground,
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    'Next: ${next!.movie!.title} · ${formatShowTime(next.startsAt)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
