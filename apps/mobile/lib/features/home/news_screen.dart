import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/prefs.dart';
import '../../core/theme.dart';
import '../../ui/skeleton.dart';
import '../../ui/widgets.dart';
import 'article_screen.dart';

class NewsScreen extends StatefulWidget {
  const NewsScreen({super.key, required this.api, this.onSearch});

  final ApiClient api;
  final VoidCallback? onSearch;

  @override
  State<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends State<NewsScreen> {
  String _range = 'today';
  int _streak = 0;
  Map<String, dynamic>? _featured;
  List<Map<String, dynamic>> _articles = [];
  Set<String> _bookmarks = {};
  String? _error;
  bool _loading = true;
  bool _migrating = false;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await _migrateLocal();
    await _load();
  }

  Future<void> _migrateLocal() async {
    if (_migrating) return;
    final local = await AppPrefs.newsBookmarks();
    if (local.isEmpty) return;
    _migrating = true;
    try {
      final res = await widget.api.request(
        'POST',
        '/api/v1/articles/bookmarks/import',
        auth: true,
        body: {'ids': local},
      );
      final imported = (res['data'] as Map<String, dynamic>?)?['imported'];
      final ok = (imported as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .toSet();
      final remaining = local.where((id) => !ok.contains(id)).toList();
      await AppPrefs.setNewsBookmarks(remaining);
    } on ApiException {
      // Keep local IDs; Saved will fall back to fetch-by-id.
    } finally {
      _migrating = false;
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final feed = await widget.api.request(
        'GET',
        '/api/v1/articles?range=$_range',
        auth: true,
      );
      final me = await widget.api.request('GET', '/api/v1/me', auth: true);
      final data = feed['data'] as Map<String, dynamic>;
      final rangeReturned = data['range']?.toString();
      if (!mounted) return;

      if (_range == 'saved' && rangeReturned != 'saved') {
        await _loadSavedFallback();
        if (!mounted) return;
        setState(() {
          _streak = asInt(
            (me['data'] as Map<String, dynamic>?)?['streakCount'],
          );
          _loading = false;
        });
        return;
      }

      final featured = data['featured'] as Map<String, dynamic>?;
      final articles = (data['articles'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .toList();
      final marks = <String>{...await AppPrefs.newsBookmarks()};
      void collect(Map<String, dynamic>? row) {
        if (row == null) return;
        final id = '${row['id']}';
        if (!row.containsKey('bookmarked')) return;
        if (row['bookmarked'] == true) {
          marks.add(id);
        } else {
          marks.remove(id);
        }
      }

      collect(featured);
      for (final a in articles) {
        collect(a);
      }
      if (_range == 'saved' && rangeReturned == 'saved') {
        marks
          ..clear()
          ..addAll(articles.map((a) => '${a['id']}'));
      }
      await AppPrefs.setNewsBookmarks(marks.toList());
      if (!mounted) return;

      setState(() {
        _featured = _range == 'saved' ? null : featured;
        _articles = articles;
        _streak = asInt((me['data'] as Map<String, dynamic>?)?['streakCount']);
        _bookmarks = marks;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (_range == 'saved') {
        try {
          await _loadSavedFallback();
          if (!mounted) return;
          setState(() {
            _error = null;
            _loading = false;
          });
          return;
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _loadSavedFallback() async {
    final ids = await AppPrefs.newsBookmarks();
    final unique = [
      ...{...ids, ..._bookmarks},
    ];
    final kept = <String>[];
    final articles = <Map<String, dynamic>>[];
    for (final id in unique) {
      try {
        final res = await widget.api.request(
          'GET',
          '/api/v1/articles/$id',
          auth: true,
        );
        final card = res['data'] as Map<String, dynamic>?;
        if (card != null) {
          articles.add(card);
          kept.add(id);
        }
      } on ApiException {
        // prune missing
      }
    }
    await AppPrefs.setNewsBookmarks(kept);
    if (!mounted) return;
    setState(() {
      _featured = null;
      _articles = articles;
      _bookmarks = kept.toSet();
    });
  }

  void _snackSaved({required bool saved}) {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(saved ? 'Saved · view in Saved' : 'Removed from Saved'),
        action: saved
            ? SnackBarAction(
                label: 'View',
                textColor: AppColors.gold,
                onPressed: () {
                  setState(() => _range = 'saved');
                  _load();
                },
              )
            : null,
      ),
    );
  }

  Future<void> _toggleBookmark(String id) async {
    final saving = !_bookmarks.contains(id);
    try {
      if (saving) {
        await widget.api.request(
          'POST',
          '/api/v1/articles/$id/bookmark',
          auth: true,
        );
      } else {
        await widget.api.request(
          'DELETE',
          '/api/v1/articles/$id/bookmark',
          auth: true,
        );
      }
      final next = {..._bookmarks};
      if (saving) {
        next.add(id);
      } else {
        next.remove(id);
      }
      await AppPrefs.setNewsBookmarks(next.toList());
      if (!mounted) return;
      setState(() {
        _bookmarks = next;
        if (!saving && _range == 'saved') {
          _articles = _articles.where((a) => '${a['id']}' != id).toList();
          if ('${_featured?['id']}' == id) _featured = null;
        }
      });
      _snackSaved(saved: saving);
    } on ApiException {
      final next = {..._bookmarks};
      if (saving) {
        next.add(id);
      } else {
        next.remove(id);
      }
      await AppPrefs.setNewsBookmarks(next.toList());
      if (!mounted) return;
      setState(() {
        _bookmarks = next;
        if (!saving && _range == 'saved') {
          _articles = _articles.where((a) => '${a['id']}' != id).toList();
        }
      });
      _snackSaved(saved: saving);
    }
  }

  void _open(String id) {
    Navigator.of(context)
        .push(
          PageRouteBuilder(
            pageBuilder: (context, animation, secondaryAnimation) => Scaffold(
              body: AppAtmosphere(
                child: ArticleScreen(api: widget.api, articleId: id),
              ),
            ),
            transitionsBuilder:
                (context, animation, secondaryAnimation, child) =>
                    FadeTransition(opacity: animation, child: child),
            transitionDuration: const Duration(milliseconds: 200),
          ),
        )
        .then((result) {
          if (result == 'saved') {
            setState(() => _range = 'saved');
          }
          _load();
        });
  }

  void _setRange(String range) {
    if (_range == range) return;
    setState(() => _range = range);
    _load();
  }

  String get _emptyCopy {
    switch (_range) {
      case 'week':
        return 'Nothing in the last seven days.';
      case 'archive':
        return 'The archive is empty for your program.';
      case 'saved':
        return 'Nothing saved yet. Tap the bookmark on a brief to keep it here.';
      default:
        return 'No briefs published today. Check This Week.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SafeArea(
      bottom: false,
      child: FadeRise(
        child: RefreshIndicator(
          onRefresh: _load,
          color: AppColors.accent,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
            children: [
              StudentChrome(
                streakCount: _streak,
                api: widget.api,
                onSearch: widget.onSearch,
              ),
              const SizedBox(height: 24),
              if (_range == 'saved') ...[
                Text(
                  'YOUR SHELF',
                  style: t.labelMedium?.copyWith(
                    color: AppColors.accent,
                    letterSpacing: 1.6,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Saved\nbriefs.',
                  style: t.displayMedium?.copyWith(
                    color: AppColors.deep,
                    height: 1.05,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  _loading
                      ? 'Briefs you keep for later.'
                      : _articles.isEmpty
                      ? 'Tap the bookmark on a brief to keep it here.'
                      : '${_articles.length} kept for later.',
                  style: t.bodyMedium,
                ),
              ] else ...[
                Text(
                  'THE DAILY DIGEST',
                  style: t.labelMedium?.copyWith(
                    color: AppColors.accent,
                    letterSpacing: 1.6,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Curated\nInsights.',
                  style: t.displayMedium?.copyWith(
                    color: AppColors.accent,
                    height: 1.05,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Stay ahead of the curve with daily snippets structured for your program.',
                  style: t.bodyMedium,
                ),
              ],
              const SizedBox(height: 20),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: const Color(0xFFF2F4F6),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: Row(
                    children: [
                      _RangeChip(
                        label: 'Today',
                        selected: _range == 'today',
                        onTap: () => _setRange('today'),
                      ),
                      _RangeChip(
                        label: 'Week',
                        selected: _range == 'week',
                        onTap: () => _setRange('week'),
                      ),
                      _RangeChip(
                        label: 'Archive',
                        selected: _range == 'archive',
                        onTap: () => _setRange('archive'),
                      ),
                      _RangeChip(
                        label: 'Saved',
                        selected: _range == 'saved',
                        gold: true,
                        onTap: () => _setRange('saved'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              if (_error != null) InlineError(_error!),
              if (_loading && _articles.isEmpty && _featured == null)
                const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: NewsSkeleton(),
                ),
              if (_range == 'saved' && !_loading)
                ..._articles.map(
                  (a) => Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: _SavedCard(
                      article: a,
                      onOpen: () => _open('${a['id']}'),
                      onRemove: () => _toggleBookmark('${a['id']}'),
                    ),
                  ),
                )
              else ...[
                if (_featured != null) ...[
                  _FeaturedCard(
                    article: _featured!,
                    bookmarked: _bookmarks.contains('${_featured!['id']}'),
                    onOpen: () => _open('${_featured!['id']}'),
                    onBookmark: () => _toggleBookmark('${_featured!['id']}'),
                  ),
                  const SizedBox(height: 28),
                ],
                ..._articles.map(
                  (a) => Padding(
                    padding: const EdgeInsets.only(bottom: 28),
                    child: _SnippetCard(
                      article: a,
                      bookmarked: _bookmarks.contains('${a['id']}'),
                      onOpen: () => _open('${a['id']}'),
                      onBookmark: () => _toggleBookmark('${a['id']}'),
                    ),
                  ),
                ),
              ],
              if (!_loading && _featured == null && _articles.isEmpty)
                _range == 'saved'
                    ? const _SavedEmpty()
                    : Padding(
                        padding: const EdgeInsets.only(top: 24),
                        child: Text(
                          _emptyCopy,
                          style: t.bodyMedium,
                          textAlign: TextAlign.center,
                        ),
                      ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RangeChip extends StatelessWidget {
  const _RangeChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.gold = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    final selectedBg = gold ? AppColors.goldSoft : Colors.white;
    final selectedFg = gold ? AppColors.deep : AppColors.accent;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? selectedBg : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: AppColors.ink.withValues(alpha: 0.06),
                      blurRadius: 8,
                    ),
                  ]
                : null,
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: selected ? selectedFg : AppColors.inkSoft,
              fontWeight: FontWeight.w800,
              fontSize: 11,
            ),
          ),
        ),
      ),
    );
  }
}

class _FeaturedCard extends StatelessWidget {
  const _FeaturedCard({
    required this.article,
    required this.bookmarked,
    required this.onOpen,
    required this.onBookmark,
  });

  final Map<String, dynamic> article;
  final bool bookmarked;
  final VoidCallback onOpen;
  final VoidCallback onBookmark;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final src = AppConfig.mediaUrl(article['imageUrl']?.toString());
    var tag = article['tag']?.toString();
    if (tag != null && tag.isNotEmpty && !tag.startsWith('#')) tag = '#$tag';
    final time = article['timeAgo']?.toString() ?? '';
    final excerpt = '${article['excerpt'] ?? ''}'.trim();

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadii.hero),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.deep, AppColors.deepMid, AppColors.accent],
        ),
        boxShadow: AppShadows.lift,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (src != null)
            Stack(
              children: [
                GestureDetector(
                  onTap: onOpen,
                  child: Image.network(
                    src,
                    height: 176,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) =>
                        const SizedBox(height: 8),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 72,
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            AppColors.deep.withValues(alpha: 0.92),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(top: 14, left: 14, child: _LeadPill(t: t)),
                Positioned(
                  top: 8,
                  right: 8,
                  child: _FeaturedBookmark(
                    bookmarked: bookmarked,
                    onTap: onBookmark,
                  ),
                ),
              ],
            )
          else
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 18, 12, 0),
              child: Row(
                children: [
                  _LeadPill(t: t),
                  const Spacer(),
                  _FeaturedBookmark(bookmarked: bookmarked, onTap: onBookmark),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 16, 22, 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (tag != null && tag.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          tag.toUpperCase(),
                          style: t.labelLarge?.copyWith(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    if (time.isNotEmpty)
                      Text(
                        time,
                        style: t.bodySmall?.copyWith(color: Colors.white60),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: onOpen,
                  child: Text(
                    '${article['title']}',
                    style: t.headlineMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                ),
                if (excerpt.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    excerpt,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: t.bodyMedium?.copyWith(
                      color: Colors.white70,
                      height: 1.45,
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: FilledButton(
                    onPressed: onOpen,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.gold,
                      foregroundColor: AppColors.deep,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      'DEEP DIVE',
                      style: t.labelLarge?.copyWith(
                        color: AppColors.deep,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LeadPill extends StatelessWidget {
  const _LeadPill({required this.t});
  final TextTheme t;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.gold,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        'LEAD BRIEF',
        style: t.labelLarge?.copyWith(
          color: AppColors.deep,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}

class _FeaturedBookmark extends StatelessWidget {
  const _FeaturedBookmark({required this.bookmarked, required this.onTap});

  final bool bookmarked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.16),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(
            bookmarked ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
            color: bookmarked ? AppColors.gold : Colors.white,
            size: 20,
          ),
        ),
      ),
    );
  }
}

class _SnippetCard extends StatelessWidget {
  const _SnippetCard({
    required this.article,
    required this.bookmarked,
    required this.onOpen,
    required this.onBookmark,
  });

  final Map<String, dynamic> article;
  final bool bookmarked;
  final VoidCallback onOpen;
  final VoidCallback onBookmark;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final src = AppConfig.mediaUrl(article['imageUrl']?.toString());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _NewsMeta(
          article: article,
          trailing: IconButton(
            tooltip: bookmarked ? 'Remove from Saved' : 'Save article',
            onPressed: onBookmark,
            visualDensity: VisualDensity.compact,
            icon: Icon(
              bookmarked
                  ? Icons.bookmark_rounded
                  : Icons.bookmark_border_rounded,
              color: bookmarked ? AppColors.accent : AppColors.muted,
            ),
          ),
        ),
        const SizedBox(height: 10),
        InkWell(
          onTap: onOpen,
          borderRadius: BorderRadius.circular(20),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${article['title']}', style: t.titleLarge),
                    const SizedBox(height: 8),
                    Text(
                      '${article['excerpt'] ?? ''}',
                      style: t.bodyMedium,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'READ FULL ANALYSIS →',
                      style: t.labelLarge?.copyWith(
                        color: AppColors.accent,
                        letterSpacing: 0.8,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              if (src != null) ...[
                const SizedBox(width: 14),
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Image.network(
                    src,
                    width: 96,
                    height: 96,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => Container(
                      width: 96,
                      height: 96,
                      color: const Color(0xFFECEEF0),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _NewsMeta extends StatelessWidget {
  const _NewsMeta({required this.article, this.trailing});

  final Map<String, dynamic> article;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    var tag = article['tag']?.toString();
    if (tag != null && tag.isNotEmpty && !tag.startsWith('#')) {
      tag = '#$tag';
    }
    final time = article['timeAgo']?.toString() ?? '';
    final read = article['read'] == true;
    final meta = Wrap(
      spacing: 8,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        if (tag != null && tag.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.accentSoft,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              tag.toUpperCase(),
              style: t.labelLarge?.copyWith(
                color: AppColors.accent,
                fontSize: 10,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        if (time.isNotEmpty) Text(time, style: t.bodySmall),
        if (read)
          Text(
            'READ',
            style: t.labelLarge?.copyWith(
              color: AppColors.muted,
              fontSize: 10,
              letterSpacing: 0.8,
            ),
          ),
      ],
    );
    if (trailing == null) return meta;
    return Row(
      children: [
        Expanded(child: meta),
        trailing!,
      ],
    );
  }
}

class _SavedCard extends StatelessWidget {
  const _SavedCard({
    required this.article,
    required this.onOpen,
    required this.onRemove,
  });

  final Map<String, dynamic> article;
  final VoidCallback onOpen;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final src = AppConfig.mediaUrl(article['imageUrl']?.toString());
    var tag = article['tag']?.toString();
    if (tag != null && tag.isNotEmpty && !tag.startsWith('#')) tag = '#$tag';
    final time = article['timeAgo']?.toString() ?? '';
    final read = article['read'] == true;

    return MeritCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: onOpen,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: src != null
                  ? Image.network(
                      src,
                      width: 88,
                      height: 88,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) =>
                          const _SavedThumb(),
                    )
                  : const _SavedThumb(),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: GestureDetector(
              onTap: onOpen,
              behavior: HitTestBehavior.opaque,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if (tag != null && tag.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.accentSoft,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            tag.toUpperCase(),
                            style: t.labelLarge?.copyWith(
                              color: AppColors.accent,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      if (time.isNotEmpty) Text(time, style: t.bodySmall),
                      if (read)
                        Text(
                          'READ',
                          style: t.labelLarge?.copyWith(
                            color: AppColors.muted,
                            fontSize: 10,
                            letterSpacing: 0.8,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${article['title']}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: t.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${article['excerpt'] ?? ''}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: t.bodySmall,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 4),
          Material(
            color: AppColors.goldSoft,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onRemove,
              child: const Padding(
                padding: EdgeInsets.all(8),
                child: Icon(
                  Icons.bookmark_rounded,
                  color: AppColors.deep,
                  size: 18,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SavedThumb extends StatelessWidget {
  const _SavedThumb();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 88,
      height: 88,
      decoration: BoxDecoration(
        color: AppColors.accentSoft,
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Icon(Icons.bookmark_rounded, color: AppColors.accent),
    );
  }
}

class _SavedEmpty extends StatelessWidget {
  const _SavedEmpty();

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(
              color: AppColors.goldSoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.bookmark_border_rounded,
              color: AppColors.deep,
              size: 32,
            ),
          ),
          const SizedBox(height: 20),
          Text('Nothing saved yet', style: t.headlineSmall),
          const SizedBox(height: 8),
          Text(
            'Tap the bookmark on a brief to keep it on this shelf.',
            textAlign: TextAlign.center,
            style: t.bodyMedium,
          ),
        ],
      ),
    );
  }
}
