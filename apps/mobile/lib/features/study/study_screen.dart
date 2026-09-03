import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';
import '../catalog/unlock_book_sheet.dart';

class StudyScreen extends StatefulWidget {
  const StudyScreen({
    super.key,
    required this.api,
    this.subjectId,
    this.bookId,
    required this.onClearSubject,
    required this.onOpenMcq,
    required this.onOpenCards,
    this.onSearch,
  });

  final ApiClient api;
  final String? subjectId;
  final String? bookId;
  final VoidCallback onClearSubject;
  final void Function({String? chapterId, String? subjectId}) onOpenMcq;
  final void Function({String? chapterId, String? subjectId}) onOpenCards;
  final VoidCallback? onSearch;

  @override
  State<StudyScreen> createState() => _StudyScreenState();
}

class _StudyScreenState extends State<StudyScreen> {
  Map<String, dynamic>? _data;
  Map<String, dynamic>? _book;
  String? _error;
  String? _localSubjectId;

  @override
  void initState() {
    super.initState();
    _localSubjectId = widget.subjectId;
    _load();
  }

  @override
  void didUpdateWidget(covariant StudyScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.subjectId != widget.subjectId) {
      _localSubjectId = widget.subjectId;
    }
  }

  Future<void> _load() async {
    try {
      final res = await widget.api.request('GET', '/api/v1/me/tracker', auth: true);
      Map<String, dynamic>? book;
      if (widget.bookId != null) {
        final bookRes = await widget.api.request('GET', '/api/v1/catalog/books/${widget.bookId}', auth: true);
        book = bookRes['data'] as Map<String, dynamic>;
      }
      setState(() {
        _data = res['data'] as Map<String, dynamic>;
        _book = book;
        _error = null;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final subjects = (_data?['subjects'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    final completion = _data?['completion'] as Map<String, dynamic>? ?? {};
    final rec = _data?['recommended'] as Map<String, dynamic>?;
    final pct = asInt(completion['pct']);
    final streak = asInt(_data?['streakCount']);
    Map<String, dynamic>? focused;
    if (_localSubjectId != null) {
      for (final s in subjects) {
        if ('${s['id']}' == _localSubjectId) {
          focused = s;
          break;
        }
      }
    }

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
                streakCount: streak,
                api: widget.api,
                onSearch: widget.onSearch,
              ),
              const SizedBox(height: 20),
              if (_error != null) InlineError(_error!),
              if (_book != null) ...[
                TextButton(
                  onPressed: widget.onClearSubject,
                  child: const Align(
                    alignment: Alignment.centerLeft,
                    child: Text('← Search'),
                  ),
                ),
                Text('${_book!['title']}', style: t.displayMedium),
                const SizedBox(height: 8),
                Text('${_book!['subtitle'] ?? ''}', style: t.bodyMedium),
                if (_book!['cta'] != 'study') ...[
                  const SizedBox(height: 16),
                  PrimaryButton(
                    label: asInt(_book!['price']) > 0
                        ? 'Unlock ₹${asInt(_book!['price'])}'
                        : 'Add to study set',
                    onPressed: () async {
                      final ok = await showUnlockBookSheet(context, widget.api, '${_book!['id']}');
                      if (ok) _load();
                    },
                  ),
                ],
                const SizedBox(height: 20),
                ...((_book!['chapters'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().map((ch) {
                  final canStudy = _book!['cta'] == 'study';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: MeritCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${ch['title']}', style: t.titleMedium),
                          const SizedBox(height: 4),
                          Text('${asInt(ch['mcqCount'])} MCQs · ${asInt(ch['flashCount'])} cards', style: t.bodySmall),
                          const SizedBox(height: 12),
                          if (canStudy)
                            Row(
                              children: [
                                Expanded(
                                  child: FilledButton(
                                    onPressed: () => widget.onOpenMcq(chapterId: '${ch['id']}'),
                                    child: const Text('Practice MCQ'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () => widget.onOpenCards(chapterId: '${ch['id']}'),
                                    child: const Text('Flashcards'),
                                  ),
                                ),
                              ],
                            )
                          else
                            Text('Locked until you add this book', style: t.bodySmall?.copyWith(color: AppColors.muted)),
                        ],
                      ),
                    ),
                  );
                })),
              ] else if (focused != null) ...[
                TextButton(
                  onPressed: () {
                    setState(() => _localSubjectId = null);
                    widget.onClearSubject();
                  },
                  child: const Align(
                    alignment: Alignment.centerLeft,
                    child: Text('← All subjects'),
                  ),
                ),
                Text('${focused['name']}', style: t.displayMedium),
                if (focused['blurb'] != null) ...[
                  const SizedBox(height: 8),
                  Text('${focused['blurb']}', style: t.bodyMedium),
                ],
                const SizedBox(height: 20),
                ...((focused['chapters'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().map((ch) {
                  final reliable = ch['reliable'] == true;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: MeritCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(child: Text('${ch['title']}', style: t.titleMedium)),
                              Text('${asInt(ch['completionPct'])}% done', style: t.bodySmall?.copyWith(color: AppColors.accent, fontWeight: FontWeight.w700)),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text('${asInt(ch['mcqCount'])} MCQs · ${asInt(ch['flashCount'])} cards', style: t.bodySmall),
                          const SizedBox(height: 10),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(99),
                            child: LinearProgressIndicator(
                              value: asInt(ch['completionPct']) / 100,
                              minHeight: 6,
                              backgroundColor: const Color(0xFFECEEF0),
                              color: AppColors.accent,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Mastery ${ch['masteryPct'] == null ? '—' : '${asInt(ch['masteryPct'])}%'}${reliable ? '' : ' · needs 5 attempts'}',
                            style: t.bodySmall?.copyWith(color: reliable ? AppColors.accent : AppColors.muted),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: FilledButton(
                                  onPressed: () => widget.onOpenMcq(chapterId: '${ch['id']}'),
                                  child: const Text('Practice MCQ'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () => widget.onOpenCards(chapterId: '${ch['id']}'),
                                  child: const Text('Flashcards'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                })),
              ] else ...[
                Container(
                  padding: const EdgeInsets.all(28),
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
                      Text('OVERALL PREPARATION', style: t.labelMedium?.copyWith(color: Colors.white70, letterSpacing: 1.6)),
                      const SizedBox(height: 8),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text('$pct%', style: t.displayLarge?.copyWith(color: Colors.white)),
                          const SizedBox(width: 8),
                          Text('Syllabus covered', style: t.bodySmall?.copyWith(color: Colors.white70)),
                        ],
                      ),
                      const SizedBox(height: 16),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: LinearProgressIndicator(
                          value: pct / 100,
                          minHeight: 8,
                          backgroundColor: Colors.white24,
                          color: const Color(0xFF4EDEA3),
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (rec != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.white10,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text('Next: ${rec['title']}', style: t.bodySmall?.copyWith(color: Colors.white)),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),
                Text('Core Subjects', style: t.headlineSmall),
                const SizedBox(height: 14),
                if (subjects.isEmpty)
                  MeritCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('No subjects in your study set yet', style: t.titleMedium),
                        const SizedBox(height: 8),
                        Text(
                          'Finish curriculum setup, or search for a book to add.',
                          style: t.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ...subjects.map((s) {
                  final practice = s['cta'] == 'practice';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: MeritCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                radius: 24,
                                backgroundColor: AppColors.accentSoft,
                                child: Text(
                                  initialsOf('${s['name']}'),
                                  style: t.titleMedium?.copyWith(color: AppColors.accent),
                                ),
                              ),
                              const Spacer(),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: asInt(s['completionPct']) >= 50
                                      ? const Color(0xFF4EDEA3).withValues(alpha: 0.25)
                                      : const Color(0xFFECEEF0),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '${asInt(s['completionPct'])}% Done',
                                  style: t.bodySmall?.copyWith(
                                    color: asInt(s['completionPct']) >= 50 ? AppColors.success : AppColors.inkSoft,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(child: Text('${s['name']}', style: t.titleLarge)),
                              if (s['addon'] == true)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.accentSoft,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    'Add-on',
                                    style: t.bodySmall?.copyWith(
                                      color: AppColors.accent,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${s['blurb'] ?? (s['addon'] == true ? 'Paid add-on from another program.' : 'Practice this subject from your curriculum.')}',
                            style: t.bodySmall,
                          ),
                          const SizedBox(height: 14),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(99),
                            child: LinearProgressIndicator(
                              value: asInt(s['completionPct']) / 100,
                              minHeight: 6,
                              backgroundColor: const Color(0xFFECEEF0),
                              color: AppColors.accent,
                            ),
                          ),
                          const SizedBox(height: 14),
                          if (practice)
                            PrimaryButton(
                              label: 'Start Practice',
                              onPressed: () => widget.onOpenMcq(subjectId: '${s['id']}'),
                            )
                          else
                            SecondaryButton(
                              label: 'Review',
                              onPressed: () => setState(() => _localSubjectId = '${s['id']}'),
                            ),
                          TextButton(
                            onPressed: () => setState(() => _localSubjectId = '${s['id']}'),
                            child: const Text('View chapters'),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                if (rec != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF2F4F6),
                      borderRadius: BorderRadius.circular(32),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('RECOMMENDED FOR YOU', style: t.labelMedium),
                        const SizedBox(height: 8),
                        Text('${rec['title']}', style: t.titleLarge),
                        const SizedBox(height: 4),
                        Text('${rec['reason']} · ${rec['subjectName']}', style: t.bodySmall),
                        const SizedBox(height: 16),
                        PrimaryButton(
                          label: 'Start this chapter',
                          onPressed: () => widget.onOpenMcq(chapterId: '${rec['chapterId']}'),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}
