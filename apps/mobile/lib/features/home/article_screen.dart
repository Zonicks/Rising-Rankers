import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/prefs.dart';
import '../../core/theme.dart';
import '../../ui/skeleton.dart';
import '../../ui/widgets.dart';

class ArticleScreen extends StatefulWidget {
  const ArticleScreen({super.key, required this.api, required this.articleId});

  final ApiClient api;
  final String articleId;

  @override
  State<ArticleScreen> createState() => _ArticleScreenState();
}

class _ArticleScreenState extends State<ArticleScreen> {
  final _scroll = ScrollController();
  Map<String, dynamic>? _article;
  String? _error;
  bool _bookmarked = false;
  bool _marked = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await widget.api.request(
        'GET',
        '/api/v1/articles/${widget.articleId}',
        auth: true,
      );
      final marks = await AppPrefs.newsBookmarks();
      if (!mounted) return;
      final data = res['data'] as Map<String, dynamic>;
      setState(() {
        _article = data;
        _bookmarked =
            data['bookmarked'] == true || marks.contains(widget.articleId);
        _marked = data['read'] == true;
      });
      if (data['read'] != true) {
        _timer = Timer(const Duration(seconds: 20), _markRead);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  void _onScroll() {
    if (!_scroll.hasClients || _marked) return;
    final max = _scroll.position.maxScrollExtent;
    if (max <= 0) return;
    if (_scroll.offset >= max - 48) _markRead();
  }

  Future<void> _markRead() async {
    if (_marked) return;
    _marked = true;
    _timer?.cancel();
    try {
      final res = await widget.api.request(
        'POST',
        '/api/v1/articles/${widget.articleId}/read',
        auth: true,
      );
      final data = res['data'] as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _article = {...?_article, 'read': true};
      });
      showRewardsToast(context, data['rewards'] as Map<String, dynamic>?);
    } catch (_) {
      _marked = false;
    }
  }

  Future<void> _toggleBookmark() async {
    final saving = !_bookmarked;
    try {
      if (saving) {
        await widget.api.request(
          'POST',
          '/api/v1/articles/${widget.articleId}/bookmark',
          auth: true,
        );
      } else {
        await widget.api.request(
          'DELETE',
          '/api/v1/articles/${widget.articleId}/bookmark',
          auth: true,
        );
      }
    } on ApiException {
      // Keep a local copy if the server does not know Saved yet.
    }
    final marks = await AppPrefs.newsBookmarks();
    if (saving) {
      if (!marks.contains(widget.articleId)) marks.add(widget.articleId);
    } else {
      marks.remove(widget.articleId);
    }
    await AppPrefs.setNewsBookmarks(marks);
    if (!mounted) return;
    setState(() => _bookmarked = saving);
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(saving ? 'Saved · view in Saved' : 'Removed from Saved'),
        action: saving
            ? SnackBarAction(
                label: 'View',
                textColor: AppColors.gold,
                onPressed: () => Navigator.of(context).pop('saved'),
              )
            : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final article = _article;
    final src = AppConfig.mediaUrl(article?['imageUrl']?.toString());
    var tag = article?['tag']?.toString();
    if (tag != null && tag.isNotEmpty && !tag.startsWith('#')) tag = '#$tag';
    final paragraphs = (article?['body']?.toString() ?? '')
        .split(RegExp(r'\n{2,}'))
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty)
        .toList();

    return SafeArea(
      child: FadeRise(
        child: article == null && _error == null
            ? const ArticleSkeleton()
            : ListView(
                controller: _scroll,
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ),
                  if (_error != null) InlineError(_error!),
                  if (article != null) ...[
                    Row(
                      children: [
                        if (tag != null && tag.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
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
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${article['timeAgo'] ?? ''}',
                            style: t.bodySmall,
                          ),
                        ),
                        IconButton(
                          tooltip: _bookmarked
                              ? 'Remove from Saved'
                              : 'Save article',
                          onPressed: _toggleBookmark,
                          icon: Icon(
                            _bookmarked
                                ? Icons.bookmark_rounded
                                : Icons.bookmark_border_rounded,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('${article['title']}', style: t.headlineLarge),
                    if (src != null) ...[
                      const SizedBox(height: 20),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: Image.network(
                          src,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) =>
                              const SizedBox.shrink(),
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    ...paragraphs.map(
                      (p) => Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Text(
                          p,
                          style: t.bodyLarge?.copyWith(
                            height: 1.55,
                            color: AppColors.inkSoft,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      article['read'] == true
                          ? 'Marked as read · +2 pts'
                          : 'Stay 20 seconds or scroll to the end to count this towards your streak.',
                      style: t.bodySmall?.copyWith(
                        color: article['read'] == true
                            ? AppColors.accent
                            : AppColors.muted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}
