import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/prefs.dart';
import '../../core/theme.dart';
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
      final feed = await widget.api.request('GET', '/api/v1/articles?range=$_range', auth: true);
      final me = await widget.api.request('GET', '/api/v1/me', auth: true);
      final data = feed['data'] as Map<String, dynamic>;
      final marks = await AppPrefs.newsBookmarks();
      if (!mounted) return;
      setState(() {
        _featured = data['featured'] as Map<String, dynamic>?;
        _articles = (data['articles'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
        _streak = asInt((me['data'] as Map<String, dynamic>?)?['streakCount']);
        _bookmarks = marks.toSet();
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _toggleBookmark(String id) async {
    final next = {..._bookmarks};
    if (next.contains(id)) {
      next.remove(id);
    } else {
      next.add(id);
    }
    await AppPrefs.setNewsBookmarks(next.toList());
    if (mounted) setState(() => _bookmarks = next);
  }

  void _open(String id) {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => Scaffold(
          body: AppAtmosphere(
            child: ArticleScreen(api: widget.api, articleId: id),
          ),
        ),
        transitionsBuilder: (context, animation, secondaryAnimation, child) =>
            FadeTransition(opacity: animation, child: child),
        transitionDuration: const Duration(milliseconds: 200),
      ),
    ).then((_) => _load());
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
              StudentChrome(streakCount: _streak, api: widget.api, onSearch: widget.onSearch),
              const SizedBox(height: 24),
              Text('THE DAILY DIGEST', style: t.labelMedium?.copyWith(color: AppColors.accent, letterSpacing: 1.6)),
              const SizedBox(height: 8),
              Text('Curated\nInsights.', style: t.displayMedium?.copyWith(color: AppColors.accent, height: 1.05)),
              const SizedBox(height: 12),
              Text(
                'Stay ahead of the curve with daily snippets structured for your program.',
                style: t.bodyMedium,
              ),
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
                        onTap: () {
                          _range = 'today';
                          _load();
                        },
                      ),
                      _RangeChip(
                        label: 'This Week',
                        selected: _range == 'week',
                        onTap: () {
                          _range = 'week';
                          _load();
                        },
                      ),
                      _RangeChip(
                        label: 'Archived',
                        selected: _range == 'archive',
                        onTap: () {
                          _range = 'archive';
                          _load();
                        },
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              if (_error != null) InlineError(_error!),
              if (_loading && _articles.isEmpty && _featured == null)
                const Padding(
                  padding: EdgeInsets.only(top: 48),
                  child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                ),
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
                  child: _SnippetCard(article: a, onOpen: () => _open('${a['id']}')),
                ),
              ),
              if (!_loading && _featured == null && _articles.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Text(
                    _range == 'today'
                        ? 'No briefs published today. Check This Week.'
                        : _range == 'week'
                            ? 'Nothing in the last seven days.'
                            : 'The archive is empty for your program.',
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
  const _RangeChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
            boxShadow: selected
                ? [BoxShadow(color: AppColors.ink.withValues(alpha: 0.06), blurRadius: 8)]
                : null,
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: selected ? AppColors.accent : AppColors.inkSoft,
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
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
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFFF2F4F6),
        borderRadius: BorderRadius.circular(32),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _NewsMeta(article: article),
          const SizedBox(height: 12),
          Text('${article['title']}', style: t.headlineMedium),
          const SizedBox(height: 12),
          Text('${article['excerpt'] ?? ''}', style: t.bodyMedium),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: onOpen,
                  child: const Text('DEEP DIVE'),
                ),
              ),
              IconButton(
                onPressed: onBookmark,
                icon: Icon(bookmarked ? Icons.bookmark_rounded : Icons.bookmark_border_rounded),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SnippetCard extends StatelessWidget {
  const _SnippetCard({required this.article, required this.onOpen});

  final Map<String, dynamic> article;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final src = AppConfig.mediaUrl(article['imageUrl']?.toString());
    return InkWell(
      onTap: onOpen,
      borderRadius: BorderRadius.circular(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _NewsMeta(article: article),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${article['title']}', style: t.titleLarge),
                    const SizedBox(height: 8),
                    Text('${article['excerpt'] ?? ''}', style: t.bodyMedium, maxLines: 3, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 10),
                    Text(
                      'READ FULL ANALYSIS →',
                      style: t.labelLarge?.copyWith(color: AppColors.accent, letterSpacing: 0.8, fontSize: 11),
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
        ],
      ),
    );
  }
}

class _NewsMeta extends StatelessWidget {
  const _NewsMeta({required this.article});

  final Map<String, dynamic> article;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    var tag = article['tag']?.toString();
    if (tag != null && tag.isNotEmpty && !tag.startsWith('#')) {
      tag = '#$tag';
    }
    final time = article['timeAgo']?.toString() ?? '';
    final read = article['read'] == true;
    return Wrap(
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
              style: t.labelLarge?.copyWith(color: AppColors.accent, fontSize: 10, fontWeight: FontWeight.w800),
            ),
          ),
        if (time.isNotEmpty) Text(time, style: t.bodySmall),
        if (read)
          Text('READ', style: t.labelLarge?.copyWith(color: AppColors.muted, fontSize: 10, letterSpacing: 0.8)),
      ],
    );
  }
}
