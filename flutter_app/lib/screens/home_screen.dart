import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../widgets/common.dart';
import 'movie_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _api = ApiClient.instance;
  final _searchController = TextEditingController();
  final _moodController = TextEditingController(text: 'tense but beautiful');

  List<Movie> _movies = [];
  MovieMeta _meta = MovieMeta();
  bool _loading = true;
  String? _error;
  Timer? _searchDebounce;

  /// Active catalog filters, keyed by API query-param name.
  final Map<String, String> _filters = {};

  // AI match state
  String? _matchCity;
  bool _matchLoading = false;
  String? _matchError;
  String? _matchProvider;
  List<Recommendation> _recommendations = [];

  static const _presets = ['date night', 'edge of seat', 'family friendly'];

  @override
  void initState() {
    super.initState();
    _loadMeta();
    _loadMovies();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    _moodController.dispose();
    super.dispose();
  }

  Future<void> _loadMeta() async {
    try {
      final data = await _api.get('/movies/meta/cities');
      if (!mounted) return;
      setState(
        () => _meta = MovieMeta.fromJson((data as Map).cast<String, dynamic>()),
      );
    } catch (_) {
      // Filters simply stay empty if meta fails; movie list still works.
    }
  }

  Future<void> _loadMovies() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final query = <String, String>{
        if (_searchController.text.trim().isNotEmpty)
          'q': _searchController.text.trim(),
        ..._filters,
      };
      final data = await _api.get('/movies', query: query);
      if (!mounted) return;
      setState(() {
        _movies = ((data['movies'] as List?) ?? [])
            .whereType<Map<String, dynamic>>()
            .map(Movie.fromJson)
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

  void _onSearchChanged(String _) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 450), _loadMovies);
  }

  Future<void> _runMatch() async {
    final mood = _moodController.text.trim();
    if (mood.length < 2) {
      setState(() => _matchError = 'Describe the night in a few words first.');
      return;
    }
    setState(() {
      _matchLoading = true;
      _matchError = null;
    });
    try {
      final data = await _api.post('/ai/recommend', {
        'mood': mood,
        if (_matchCity != null && _matchCity!.isNotEmpty) 'city': _matchCity,
      });
      if (!mounted) return;
      setState(() {
        _recommendations = ((data['recommendations'] as List?) ?? [])
            .whereType<Map<String, dynamic>>()
            .map(Recommendation.fromJson)
            .toList();
        _matchProvider = data['provider'] as String?;
        _matchLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _matchError = e.toString();
        _matchLoading = false;
      });
    }
  }

  void _openMovie(String slug) {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => MovieScreen(slug: slug)));
  }

  Movie? _movieForRecommendation(Recommendation rec) {
    for (final m in _movies) {
      if (m.id == rec.movieId ||
          m.title.toLowerCase() == rec.title.toLowerCase()) {
        return m;
      }
    }
    return null;
  }

  Future<void> _openFilters() async {
    final updated = await showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _FilterSheet(meta: _meta, initial: Map.of(_filters)),
    );
    if (updated != null) {
      setState(() {
        _filters
          ..clear()
          ..addAll(updated);
      });
      _loadMovies();
    }
  }

  @override
  Widget build(BuildContext context) {
    final hero = _movies.isNotEmpty ? _movies.first : null;
    final featured = _movies.take(3).toList();

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([_loadMeta(), _loadMovies()]);
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(child: _buildHero(hero, featured)),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
            sliver: SliverToBoxAdapter(
              child: SectionHeader(
                title: 'Browse live shows',
                subtitle: 'Filter by city, screen, format, and more.',
                trailing: _FilterButton(
                  count: _filters.length,
                  onTap: _openFilters,
                ),
              ),
            ),
          ),
          if (_filters.isNotEmpty)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              sliver: SliverToBoxAdapter(child: _activeFilterChips()),
            ),
          if (_error != null)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              sliver: SliverToBoxAdapter(child: ErrorBanner(_error!)),
            ),
          if (_loading)
            const SliverPadding(
              padding: EdgeInsets.symmetric(vertical: 60),
              sliver: SliverToBoxAdapter(
                child: Center(child: CircularProgressIndicator()),
              ),
            )
          else if (_movies.isEmpty)
            const SliverPadding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              sliver: SliverToBoxAdapter(
                child: EmptyState(
                  icon: Icons.theaters_outlined,
                  title: 'No shows match those filters',
                  message: 'Try clearing a filter or searching differently.',
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.56,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, i) => MovieCard(
                    movie: _movies[i],
                    onTap: () => _openMovie(_movies[i].slug),
                  ),
                  childCount: _movies.length,
                ),
              ),
            ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 28, 16, 110),
            sliver: SliverToBoxAdapter(child: _buildMatchSection()),
          ),
        ],
      ),
    );
  }

  Widget _buildHero(Movie? hero, List<Movie> featured) {
    return Container(
      decoration: const BoxDecoration(color: AppColors.inkDeep),
      child: Stack(
        children: [
          if (hero != null)
            Positioned.fill(
              child: Opacity(
                opacity: 0.42,
                child: PosterImage(hero.backdropUrl),
              ),
            ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppColors.inkDeep.withValues(alpha: 0.45),
                    AppColors.inkDeep.withValues(alpha: 0.92),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: AppColors.accent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.movie_creation_outlined,
                          color: AppColors.inkDeep,
                          size: 19,
                        ),
                      ),
                      const SizedBox(width: 9),
                      const Text(
                        'CineBook',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const Spacer(),
                      const Pill(
                        'Now showing',
                        color: Color(0x33FFFFFF),
                        textColor: Colors.white,
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  const Text(
                    'Reserve the perfect night at the movies',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 27,
                      height: 1.15,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.7,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Live seat maps, instant holds, and tickets that follow you.',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.75),
                      fontSize: 13.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _searchController,
                    onChanged: _onSearchChanged,
                    textInputAction: TextInputAction.search,
                    style: const TextStyle(fontSize: 14.5),
                    decoration: InputDecoration(
                      hintText: 'Search movies…',
                      prefixIcon: const Icon(
                        Icons.search,
                        color: AppColors.mutedForeground,
                        size: 21,
                      ),
                      suffixIcon: _searchController.text.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.close, size: 19),
                              onPressed: () {
                                _searchController.clear();
                                _loadMovies();
                              },
                            ),
                    ),
                  ),
                  if (featured.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    SizedBox(
                      height: 150,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: featured.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 10),
                        itemBuilder: (context, i) {
                          final m = featured[i];
                          return GestureDetector(
                            onTap: () => _openMovie(m.slug),
                            child: SizedBox(
                              width: 100,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: PosterImage(
                                      m.posterUrl,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    m.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _activeFilterChips() {
    const labels = {
      'genre': 'Genre',
      'chain': 'Chain',
      'screenType': 'Screen',
      'format': 'Format',
      'language': 'Language',
      'rating': 'Rating',
      'city': 'City',
      'releaseDate': 'From',
    };
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final entry in _filters.entries)
          InputChip(
            label: Text('${labels[entry.key] ?? entry.key}: ${entry.value}'),
            deleteIcon: const Icon(Icons.close, size: 16),
            onDeleted: () {
              setState(() => _filters.remove(entry.key));
              _loadMovies();
            },
          ),
        ActionChip(
          label: const Text('Clear all'),
          avatar: const Icon(Icons.filter_alt_off_outlined, size: 16),
          onPressed: () {
            setState(_filters.clear);
            _loadMovies();
          },
        ),
      ],
    );
  }

  Widget _buildMatchSection() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.auto_awesome,
                  color: AppColors.inkDeep,
                  size: 19,
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Describe the night. Get the shortlist.',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Tell the matcher what kind of evening you want and it picks from live shows.',
            style: TextStyle(fontSize: 13, color: AppColors.mutedForeground),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _moodController,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'e.g. tense but beautiful',
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final preset in _presets)
                ActionChip(
                  label: Text(preset),
                  onPressed: () =>
                      setState(() => _moodController.text = preset),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _matchCity,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.location_on_outlined, size: 19),
                  ),
                  hint: const Text('Any city', style: TextStyle(fontSize: 14)),
                  items: [
                    const DropdownMenuItem<String>(
                      value: '',
                      child: Text('Any city'),
                    ),
                    for (final c in _meta.cities)
                      DropdownMenuItem(value: c, child: Text(c)),
                  ],
                  onChanged: (v) => setState(
                    () => _matchCity = (v == null || v.isEmpty) ? null : v,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              FilledButton.icon(
                onPressed: _matchLoading ? null : _runMatch,
                icon: _matchLoading
                    ? const SizedBox(
                        width: 17,
                        height: 17,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.3,
                          color: AppColors.inkDeep,
                        ),
                      )
                    : const Icon(Icons.auto_awesome, size: 18),
                label: const Text('Match'),
              ),
            ],
          ),
          if (_matchProvider != null) ...[
            const SizedBox(height: 10),
            Pill(
              _matchProvider == 'openai'
                  ? 'Powered by OpenAI'
                  : 'Smart fallback picks',
              icon: Icons.bolt,
            ),
          ],
          if (_matchError != null) ...[
            const SizedBox(height: 10),
            ErrorBanner(_matchError!),
          ],
          const SizedBox(height: 14),
          if (_recommendations.isEmpty && !_matchLoading)
            const EmptyState(
              icon: Icons.auto_awesome_outlined,
              title: 'Ready when you are',
              message: 'Describe a mood and tap Match for a shortlist.',
            )
          else
            Column(
              children: [
                for (final rec in _recommendations) ...[
                  _RecommendationCard(
                    rec: rec,
                    movie: _movieForRecommendation(rec),
                    onOpen: _openMovie,
                  ),
                  const SizedBox(height: 10),
                ],
              ],
            ),
        ],
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: const Icon(Icons.tune, size: 17),
      label: Text(count == 0 ? 'Filters' : 'Filters ($count)'),
    );
  }
}

class _RecommendationCard extends StatelessWidget {
  const _RecommendationCard({
    required this.rec,
    required this.movie,
    required this.onOpen,
  });

  final Recommendation rec;
  final Movie? movie;
  final void Function(String slug) onOpen;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Pill(
                'Recommended',
                color: AppColors.accent,
                textColor: AppColors.inkDeep,
                icon: Icons.auto_awesome,
              ),
              const Spacer(),
              if (movie != null)
                Text(
                  movie!.genre,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.mutedForeground,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            rec.title,
            style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            rec.reason,
            style: const TextStyle(
              fontSize: 13,
              height: 1.4,
              color: AppColors.mutedForeground,
            ),
          ),
          if (movie != null) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => onOpen(movie!.slug),
                icon: const Icon(Icons.chair_outlined, size: 17),
                label: const Text('View shows'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.meta, required this.initial});

  final MovieMeta meta;
  final Map<String, String> initial;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late Map<String, String> _draft;

  @override
  void initState() {
    super.initState();
    _draft = Map.of(widget.initial);
  }

  Widget _dropdown(String label, String key, List<String> options) {
    if (options.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            // Keyed by value so "Clear all" visually resets the field.
            key: ValueKey('$key:${_draft[key] ?? ''}'),
            initialValue: _draft[key] ?? '',
            isExpanded: true,
            items: [
              DropdownMenuItem(value: '', child: Text('Any $label')),
              for (final o in options)
                DropdownMenuItem(value: o, child: Text(o)),
            ],
            onChanged: (v) => setState(() {
              if (v == null || v.isEmpty) {
                _draft.remove(key);
              } else {
                _draft[key] = v;
              }
            }),
          ),
        ],
      ),
    );
  }

  Future<void> _pickReleaseDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(now.year - 5),
      lastDate: DateTime(now.year + 2),
    );
    if (picked != null) {
      setState(
        () => _draft['releaseDate'] = DateFormat('yyyy-MM-dd').format(picked),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final meta = widget.meta;
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Filters',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
              ),
              const Spacer(),
              TextButton(
                onPressed: () => setState(_draft.clear),
                child: const Text('Clear all'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _dropdown('Genre', 'genre', meta.genres),
                  _dropdown('Chain', 'chain', meta.chains),
                  _dropdown('Screen type', 'screenType', meta.screenTypes),
                  _dropdown('Format', 'format', meta.formats),
                  _dropdown('Language', 'language', meta.languages),
                  _dropdown('Age rating', 'rating', meta.ratings),
                  _dropdown('City', 'city', meta.cities),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Released after',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _pickReleaseDate,
                              icon: const Icon(Icons.event, size: 17),
                              label: Text(
                                _draft['releaseDate'] ?? 'Any release date',
                                style: const TextStyle(fontSize: 13.5),
                              ),
                            ),
                          ),
                          if (_draft.containsKey('releaseDate'))
                            IconButton(
                              icon: const Icon(Icons.close, size: 19),
                              onPressed: () =>
                                  setState(() => _draft.remove('releaseDate')),
                            ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.of(context).pop(_draft),
              child: const Text('Apply filters'),
            ),
          ),
        ],
      ),
    );
  }
}
