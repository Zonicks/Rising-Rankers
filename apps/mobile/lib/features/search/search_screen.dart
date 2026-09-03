import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';
import '../flashcards/flashcards_screen.dart';
import '../mcq/mcq_screen.dart';
import '../study/study_screen.dart';
import '../catalog/unlock_book_sheet.dart';

void openCatalogSearch(BuildContext context, ApiClient api) {
  Navigator.of(context).push(
    PageRouteBuilder(
      pageBuilder: (context, animation, secondaryAnimation) =>
          Scaffold(body: AppAtmosphere(child: SearchScreen(api: api))),
      transitionsBuilder: (context, animation, secondaryAnimation, child) =>
          FadeTransition(opacity: animation, child: child),
      transitionDuration: const Duration(milliseconds: 240),
    ),
  );
}

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String? _error;
  bool _loading = false;
  Map<String, dynamic>? _data;
  Map<String, dynamic>? _author;
  List<Map<String, dynamic>> _authorBooks = [];

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(value.trim()));
  }

  Future<void> _search(String q) async {
    setState(() {
      _author = null;
      _authorBooks = [];
    });
    if (q.length < 2) {
      setState(() {
        _data = {'books': [], 'authors': [], 'subjects': [], 'chapters': []};
        _loading = false;
        _error = null;
      });
      return;
    }
    setState(() => _loading = true);
    try {
      final res = await widget.api.request(
        'GET',
        '/api/v1/search?q=${Uri.encodeQueryComponent(q)}',
        auth: true,
      );
      setState(() {
        _data = res['data'] as Map<String, dynamic>;
        _error = null;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _openAuthor(String id) async {
    try {
      final res = await widget.api.request('GET', '/api/v1/catalog/authors/$id/books', auth: true);
      final data = res['data'] as Map<String, dynamic>;
      setState(() {
        _author = data['author'] as Map<String, dynamic>?;
        _authorBooks = (data['books'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  void _openMcq(String chapterId) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          body: AppAtmosphere(child: McqScreen(api: widget.api, chapterId: chapterId)),
        ),
      ),
    );
  }

  void _openCards(String chapterId) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          body: AppAtmosphere(child: FlashcardsScreen(api: widget.api, chapterId: chapterId)),
        ),
      ),
    );
  }

  void _openStudy({String? subjectId, String? bookId}) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          body: AppAtmosphere(
            child: StudyScreen(
              api: widget.api,
              subjectId: subjectId,
              bookId: bookId,
              onClearSubject: () => Navigator.of(context).pop(),
              onOpenMcq: ({chapterId, subjectId}) {
                if (chapterId != null) _openMcq(chapterId);
              },
              onOpenCards: ({chapterId, subjectId}) {
                if (chapterId != null) _openCards(chapterId);
              },
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _onCta(Map<String, dynamic> hit) async {
    final cta = '${hit['cta']}';
    final kind = '${hit['kind']}';
    if (cta == 'books' || kind == 'author') {
      _openAuthor('${hit['id']}');
      return;
    }
    if (cta == 'add' || cta == 'unlock') {
      if (kind == 'subject') {
        _controller.text = '${hit['title']}';
        await _search('${hit['title']}');
        return;
      }
      final bookId = kind == 'chapter' ? '${hit['bookId'] ?? ''}' : '${hit['id']}';
      if (bookId.isEmpty || bookId == 'null') return;
      final ok = await showUnlockBookSheet(context, widget.api, bookId);
      if (ok && mounted) _openStudy(bookId: bookId);
      return;
    }
    if (cta != 'study') return;
    if (kind == 'chapter') {
      _openMcq('${hit['id']}');
      return;
    }
    if (kind == 'subject') {
      _openStudy(subjectId: '${hit['id']}');
      return;
    }
    _openStudy(bookId: '${hit['id']}');
  }

  List<Map<String, dynamic>> _list(String key) {
    return (_data?[key] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
  }

  bool get _empty {
    if (_controller.text.trim().length < 2) return false;
    return _list('books').isEmpty &&
        _list('authors').isEmpty &&
        _list('subjects').isEmpty &&
        _list('chapters').isEmpty;
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SafeArea(
      child: FadeRise(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
          children: [
            Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
                Expanded(
                  child: Text('Search', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
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
                  Text(
                    'CATALOG',
                    style: t.labelMedium?.copyWith(color: Colors.white70, letterSpacing: 1.6),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'What do you want to learn?',
                    style: t.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Search a book, author, or topic. Add-ons show a price first.',
                    style: t.bodySmall?.copyWith(color: Colors.white70),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _controller,
                    onChanged: (value) {
                      setState(() {});
                      _onChanged(value);
                    },
                    autofocus: true,
                    style: t.bodyLarge?.copyWith(color: AppColors.ink),
                    decoration: InputDecoration(
                      hintText: 'Try Laxmikanth, Spectrum, or HC Verma',
                      prefixIcon: const Icon(Icons.search_rounded, color: AppColors.muted),
                      suffixIcon: _controller.text.isEmpty
                          ? null
                          : IconButton(
                              onPressed: () {
                                _controller.clear();
                                _search('');
                              },
                              icon: const Icon(Icons.close_rounded, color: AppColors.muted),
                            ),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(20),
                        borderSide: BorderSide.none,
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(20),
                        borderSide: BorderSide.none,
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(20),
                        borderSide: const BorderSide(color: AppColors.gold, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              InlineError(_error!),
              TextButton(
                onPressed: () {
                  final q = _controller.text.trim();
                  if (_author != null) {
                    _openAuthor('${_author!['id'] ?? ''}');
                  } else if (q.length >= 2) {
                    _search(q);
                  }
                },
                child: const Text('Try again'),
              ),
            ],
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 28),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            if (_author != null) ...[
              const SizedBox(height: 20),
              TextButton(
                onPressed: () => setState(() {
                  _author = null;
                  _authorBooks = [];
                }),
                child: const Align(
                  alignment: Alignment.centerLeft,
                  child: Text('← All results'),
                ),
              ),
              Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.goldSoft,
                    child: Text(
                      initialsOf('${_author!['name']}'),
                      style: t.titleMedium?.copyWith(color: const Color(0xFF8A6A00), fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('AUTHOR', style: t.labelMedium),
                        const SizedBox(height: 4),
                        Text('${_author!['name']}', style: t.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                ],
              ),
              if (_author!['bio'] != null) ...[
                const SizedBox(height: 10),
                Text('${_author!['bio']}', style: t.bodyMedium),
              ],
              const SizedBox(height: 16),
              if (_authorBooks.isEmpty) ...[
                Text('No books for this author yet.', style: t.bodyMedium),
                const SizedBox(height: 12),
                _hints(),
              ] else
                ..._authorBooks.map(_hitCard),
            ] else if (_controller.text.trim().length < 2) ...[
              const SizedBox(height: 24),
              Text('POPULAR SEARCHES', style: t.labelMedium),
              const SizedBox(height: 12),
              _hints(),
            ] else if (_empty) ...[
              const SizedBox(height: 12),
              EmptyState(
                title: 'No matches',
                body: 'Try an author, book, or topic — or pick a demo search below.',
              ),
              _hints(),
            ] else ...[
              ..._section('Books', _list('books')),
              ..._section('Authors', _list('authors')),
              ..._section('Subjects', _list('subjects')),
              ..._section('Chapters', _list('chapters')),
            ],
          ],
        ),
      ),
    );
  }

  Widget _hints() {
    const hints = [
      ('Laxmikanth', 'UPSC · in your syllabus'),
      ('Spectrum', 'National movement'),
      ('HC Verma', 'Paid add-on · ₹49'),
      ('NEET', 'Books outside UPSC'),
    ];
    return Column(
      children: [
        for (final h in hints)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: MeritCard(
              onTap: () {
                _controller.text = h.$1;
                _search(h.$1);
              },
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppColors.accentSoft,
                    child: Text(
                      initialsOf(h.$1),
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: AppColors.accent,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(h.$1, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 2),
                        Text(h.$2, style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                  const Icon(Icons.north_west_rounded, color: AppColors.muted, size: 18),
                ],
              ),
            ),
          ),
      ],
    );
  }

  List<Widget> _section(String title, List<Map<String, dynamic>> items) {
    if (items.isEmpty) return [];
    return [
      const SizedBox(height: 22),
      Row(
        children: [
          Text(
            title.toUpperCase(),
            style: Theme.of(context).textTheme.labelMedium,
          ),
          const Spacer(),
          Text('${items.length}', style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
      const SizedBox(height: 10),
      ...items.map(_hitCard),
    ];
  }

  IconData _kindIcon(String kind) {
    if (kind == 'author') return Icons.person_rounded;
    if (kind == 'subject') return Icons.menu_book_rounded;
    if (kind == 'chapter') return Icons.quiz_rounded;
    return Icons.auto_stories_rounded;
  }

  Color _kindBg(String kind) {
    if (kind == 'author') return AppColors.goldSoft;
    if (kind == 'subject') return AppColors.successSoft;
    if (kind == 'chapter') return AppColors.bgLow;
    return AppColors.accentSoft;
  }

  Color _kindFg(String kind) {
    if (kind == 'author') return const Color(0xFF8A6A00);
    if (kind == 'subject') return AppColors.success;
    if (kind == 'chapter') return AppColors.inkSoft;
    return AppColors.accent;
  }

  Widget _hitCard(Map<String, dynamic> hit) {
    final cta = '${hit['cta']}';
    final kind = '${hit['kind']}';
    final price = hit['price'];
    final granted = hit['granted'] == true;
    final inProgram = hit['inProgram'] == true;
    String? priceText;
    if (cta == 'unlock') {
      priceText = price is num && price > 0 ? '₹${price.round()}' : 'Add-on';
    } else if (cta == 'study' && (price == 0 || granted)) {
      priceText = 'FREE';
    } else if (price is num) {
      priceText = price == 0 ? 'FREE' : '₹${price.round()}';
    }
    String ctaLabel = 'Study';
    if (cta == 'add') ctaLabel = 'Add';
    if (cta == 'books') ctaLabel = 'See books';
    if (cta == 'unlock') ctaLabel = price is num && price > 0 ? 'Unlock ₹${price.round()}' : 'Unlock';
    if (cta == 'unlock' && kind == 'subject') ctaLabel = 'See books';
    final canTap = cta == 'study' || cta == 'books' || cta == 'add' || cta == 'unlock';
    final free = priceText == 'FREE';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: MeritCard(
        onTap: canTap ? () => _onCta(hit) : null,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: _kindBg(kind),
              child: Icon(_kindIcon(kind), color: _kindFg(kind), size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.accentSoft,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          kind,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppColors.accent,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                      if (inProgram)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.successSoft,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            'In syllabus',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppColors.success,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('${hit['title']}', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  if (hit['subtitle'] != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text('${hit['subtitle']}', style: Theme.of(context).textTheme.bodySmall),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (priceText != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: free ? AppColors.successSoft : AppColors.goldSoft,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      priceText,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: free ? AppColors.success : const Color(0xFF8A6A00),
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                  ),
                const SizedBox(height: 10),
                Text(
                  ctaLabel,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: canTap ? AppColors.accent : AppColors.muted,
                      ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

