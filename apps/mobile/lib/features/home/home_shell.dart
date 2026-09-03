import 'dart:ui';
import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';
import '../flashcards/flashcards_screen.dart';
import '../mcq/mcq_screen.dart';
import '../profile/profile_screen.dart';
import '../search/search_screen.dart';
import '../study/study_screen.dart';
import '../tests/tests_screen.dart';
import 'home_screen.dart';
import 'news_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.api, required this.onSignOut});

  final ApiClient api;
  final Future<void> Function() onSignOut;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  String? _studySubjectId;

  void _push(Widget child) {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            Scaffold(body: AppAtmosphere(child: child)),
        transitionsBuilder: (context, animation, secondaryAnimation, child) =>
            FadeTransition(opacity: animation, child: child),
        transitionDuration: const Duration(milliseconds: 240),
      ),
    );
  }

  void _openMcq({String? chapterId, String? subjectId}) {
    _push(McqScreen(api: widget.api, chapterId: chapterId, subjectId: subjectId));
  }

  void _openCards({String? chapterId, String? subjectId}) {
    _push(FlashcardsScreen(api: widget.api, chapterId: chapterId, subjectId: subjectId));
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeScreen(
        api: widget.api,
        onOpenMcq: () => setState(() => _index = 2),
        onOpenCards: () => _openCards(),
        onOpenNews: () => setState(() => _index = 3),
        onOpenStudy: (id) => setState(() {
          _index = 1;
          _studySubjectId = id;
        }),
        onSearch: () => openCatalogSearch(context, widget.api),
      ),
      StudyScreen(
        api: widget.api,
        subjectId: _studySubjectId,
        onClearSubject: () => setState(() => _studySubjectId = null),
        onOpenMcq: _openMcq,
        onOpenCards: _openCards,
        onSearch: () => openCatalogSearch(context, widget.api),
      ),
      TestsScreen(api: widget.api, onSearch: () => openCatalogSearch(context, widget.api)),
      NewsScreen(api: widget.api, onSearch: () => openCatalogSearch(context, widget.api)),
      ProfileScreen(api: widget.api, onSignOut: widget.onSignOut),
    ];

    return Scaffold(
      body: AppAtmosphere(
        child: Stack(
          children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              switchInCurve: Curves.easeOut,
              switchOutCurve: Curves.easeIn,
              child: KeyedSubtree(
                key: ValueKey('$_index-$_studySubjectId'),
                child: pages[_index],
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _MeritNavBar(
                index: _index,
                onChanged: (i) => setState(() => _index = i),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MeritNavBar extends StatelessWidget {
  const _MeritNavBar({required this.index, required this.onChanged});

  final int index;
  final ValueChanged<int> onChanged;

  static const _items = [
    (Icons.home_outlined, Icons.home_rounded, 'Home'),
    (Icons.menu_book_outlined, Icons.menu_book_rounded, 'Study'),
    (Icons.quiz_outlined, Icons.quiz_rounded, 'Quiz'),
    (Icons.article_outlined, Icons.article_rounded, 'News'),
    (Icons.person_outline_rounded, Icons.person_rounded, 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Material(
      color: Colors.transparent,
      child: ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.8),
            border: Border(
              top: BorderSide(color: AppColors.line.withValues(alpha: 0.15)),
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.ink.withValues(alpha: 0.04),
                blurRadius: 24,
                offset: const Offset(0, -8),
              ),
            ],
          ),
          child: Padding(
            padding: EdgeInsets.fromLTRB(8, 10, 8, 10 + bottom),
            child: Row(
              children: List.generate(_items.length, (i) {
                final selected = i == index;
                final item = _items[i];
                return Expanded(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => onChanged(i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      curve: Curves.easeOut,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: selected ? AppColors.bgHigh : Colors.transparent,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            selected ? item.$2 : item.$1,
                            size: 22,
                            color: selected ? AppColors.accent : AppColors.muted,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.$3,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: selected ? AppColors.accent : AppColors.muted,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 10,
                                  letterSpacing: 0.6,
                                ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
      ),
    );
  }
}
