import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/device_id.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';
import '../mcq/mcq_screen.dart';

class TestsScreen extends StatefulWidget {
  const TestsScreen({super.key, required this.api, this.onSearch});

  final ApiClient api;
  final VoidCallback? onSearch;

  @override
  State<TestsScreen> createState() => _TestsScreenState();
}

class _TestsScreenState extends State<TestsScreen> {
  String _tab = 'available';
  Map<String, dynamic>? _featured;
  List<Map<String, dynamic>> _tests = [];
  List<String> _subjects = ['All'];
  List<Map<String, dynamic>> _trackerSubjects = [];
  Map<String, dynamic>? _stats;
  String _filter = 'All';
  String? _error;
  String? _msg;
  bool _loading = true;
  bool _busy = false;
  int _streak = 0;

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
      final res = await widget.api.request('GET', '/api/v1/tests', auth: true);
      final stats = await widget.api.request('GET', '/api/v1/me/quiz-stats', auth: true);
      Map<String, dynamic>? tracker;
      try {
        final tr = await widget.api.request('GET', '/api/v1/me/tracker', auth: true);
        tracker = tr['data'] as Map<String, dynamic>?;
      } catch (_) {}
      final data = res['data'] as Map<String, dynamic>;
      final tests = (data['tests'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
      final subjects = (data['subjects'] as List<dynamic>? ?? []).map((s) => '$s').toList();
      setState(() {
        _featured = data['featured'] is Map ? Map<String, dynamic>.from(data['featured'] as Map) : null;
        _tests = tests;
        _subjects = ['All', ...subjects];
        _stats = stats['data'] as Map<String, dynamic>?;
        _trackerSubjects = (tracker?['subjects'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();
        _streak = asInt(tracker?['streakCount']);
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_filter == 'All') return _tests;
    return _tests.where((t) => '${t['subject']}' == _filter).toList();
  }

  Future<void> _start(Map<String, dynamic> test) async {
    final cta = test['cta']?.toString();
    final charge = asInt(test['chargeAmount']);
    if (cta == 'ended') {
      setState(() => _msg = 'This live test has ended.');
      return;
    }
    if (cta == 'result') {
      await _openAttempt(test['id'] as String, viewResultOnly: true);
      return;
    }
    if (charge > 0) {
      final ok = await showModalBottomSheet<bool>(
        context: context,
        isDismissible: !_busy,
        enableDrag: !_busy,
        backgroundColor: AppColors.bgElevated,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        builder: (ctx) => _ConfirmEntrySheet(
          title: '${test['title']}',
          charge: charge,
          onPay: () => _join(test['id'] as String, openAfter: false),
        ),
      );
      if (ok != true) return;
      await _openAttempt(test['id'] as String);
      return;
    }
    await _join(test['id'] as String);
  }

  Future<void> _join(String id, {bool openAfter = true}) async {
    setState(() {
      _busy = true;
      _msg = null;
    });
    try {
      final deviceId = await DeviceId.get();
      await widget.api.request(
        'POST',
        '/api/v1/devices/register',
        auth: true,
        body: {'deviceId': deviceId, 'platform': 'flutter'},
      );
      await widget.api.request('POST', '/api/v1/tests/$id/join', auth: true);
      if (!mounted) return;
      if (openAfter) await _openAttempt(id, deviceId: deviceId);
    } on ApiException catch (e) {
      setState(() => _msg = e.message);
      if (!openAfter) rethrow;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openAttempt(String id, {String? deviceId, bool viewResultOnly = false}) async {
    final did = deviceId ?? await DeviceId.get();
    if (!mounted) return;
    await Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            TestAttemptScreen(
              api: widget.api,
              testId: id,
              deviceId: did,
              viewResultOnly: viewResultOnly,
            ),
        transitionsBuilder: (context, animation, secondaryAnimation, child) =>
            FadeTransition(opacity: animation, child: child),
        transitionDuration: const Duration(milliseconds: 200),
      ),
    );
    await _load();
  }

  void _openCustom() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgElevated,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Custom quiz', style: Theme.of(ctx).textTheme.labelMedium),
            const SizedBox(height: 8),
            Text('10-question practice', style: Theme.of(ctx).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text('Uses your daily MCQ quota, or a paid unlock if none are left.', style: Theme.of(ctx).textTheme.bodyMedium),
            const SizedBox(height: 16),
            if (_trackerSubjects.isEmpty)
              PrimaryButton(
                label: 'Start mixed practice',
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.of(context).push(
                    PageRouteBuilder(
                      pageBuilder: (context, animation, secondaryAnimation) =>
                          Scaffold(body: AppAtmosphere(child: McqScreen(api: widget.api))),
                      transitionsBuilder: (context, animation, secondaryAnimation, child) =>
                          FadeTransition(opacity: animation, child: child),
                    ),
                  );
                },
              )
            else
              ..._trackerSubjects.map(
                (s) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: SecondaryButton(
                    label: '${s['name']}',
                    onPressed: () {
                      Navigator.pop(ctx);
                      Navigator.of(context).push(
                        PageRouteBuilder(
                          pageBuilder: (context, animation, secondaryAnimation) => Scaffold(
                            body: AppAtmosphere(child: McqScreen(api: widget.api, subjectId: '${s['id']}')),
                          ),
                          transitionsBuilder: (context, animation, secondaryAnimation, child) =>
                              FadeTransition(opacity: animation, child: child),
                        ),
                      );
                    },
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _ctaLabel(Map<String, dynamic> t) {
    final cta = t['cta']?.toString();
    if (cta == 'retake') return 'Retake';
    if (cta == 'result') return 'View result';
    if (cta == 'ended') return 'Ended';
    if (cta == 'resume') return 'Resume';
    return 'Start Test';
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final featured = _featured;
    final days = (_stats?['days'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    final results = (_stats?['results'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    final maxBar = days.fold<int>(1, (n, d) => asInt(d['scorePct']) > n ? asInt(d['scorePct']) : n);
    final hPad = MediaQuery.sizeOf(context).width < 380 ? 14.0 : 20.0;

    return SafeArea(
      bottom: false,
      child: FadeRise(
        child: Stack(
          children: [
            RefreshIndicator(
              onRefresh: _load,
              color: AppColors.accent,
              child: ListView(
                padding: EdgeInsets.fromLTRB(hPad, 12, hPad, 140),
                children: [
                  StudentChrome(streakCount: _streak, api: widget.api, onSearch: widget.onSearch),
                  const SizedBox(height: 20),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: _QuizTab(
                          label: 'Available Tests',
                          selected: _tab == 'available',
                          onTap: () => setState(() => _tab = 'available'),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _QuizTab(
                          label: 'Results & Analysis',
                          selected: _tab == 'results',
                          onTap: () => setState(() => _tab = 'results'),
                        ),
                      ),
                    ],
                  ),
                  if (_error != null) ...[const SizedBox(height: 16), InlineError(_error!)],
                  if (_msg != null) ...[
                    const SizedBox(height: 12),
                    Text(_msg!, style: t.bodyMedium?.copyWith(color: AppColors.accent)),
                  ],
                  if (_loading)
                    const Padding(
                      padding: EdgeInsets.only(top: 64),
                      child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                    )
                  else if (_tab == 'available') ...[
                    if (featured != null) ...[
                      const SizedBox(height: 22),
                      Container(
                        padding: const EdgeInsets.all(24),
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
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(99)),
                              child: Text('FEATURED CHALLENGE', style: t.labelMedium?.copyWith(color: Colors.white)),
                            ),
                            const SizedBox(height: 12),
                            Text('${featured['title']}', style: t.headlineMedium?.copyWith(color: Colors.white)),
                            const SizedBox(height: 8),
                            Text(
                              '${asInt(featured['durationMinutes'])} mins · ${asInt(featured['questionCount'])} Qs${featured['cta'] == 'resume' && featured['remainingSeconds'] != null ? ' · ${(asInt(featured['remainingSeconds']) / 60).ceil()} min left' : ''}',
                              style: t.bodySmall?.copyWith(color: Colors.white70),
                            ),
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                _PriceChip('${featured['priceLabel']}', gold: featured['priceLabel'] != 'FREE'),
                                if (featured['awardPool'] == true)
                                  _PriceChip(
                                    '${featured['awardLabel'] ?? 'Award pool'}',
                                    gold: false,
                                  ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Align(
                              alignment: Alignment.centerRight,
                              child: FilledButton(
                                onPressed: _busy || featured['cta'] == 'ended' ? null : () => _start(featured),
                                style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.accent),
                                child: Text(_ctaLabel(featured)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 22),
                    Text('SUBJECT FOCUS', style: t.labelMedium),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 40,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _subjects.length,
                        separatorBuilder: (context, index) => const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          final s = _subjects[i];
                          final on = _filter == s;
                          return GestureDetector(
                            onTap: () => setState(() => _filter = s),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: on ? AppColors.accent : const Color(0xFFF2F4F6),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Text(
                                s == 'All' ? 'All Topics' : s,
                                style: t.titleMedium?.copyWith(color: on ? Colors.white : AppColors.inkSoft),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 16),
                    if (_filtered.isEmpty)
                      const EmptyState(title: 'No tests yet', body: 'When an admin publishes a paper, it will appear here.')
                    else
                      ..._filtered.map((test) {
                        final completed = test['completed'] == true;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Opacity(
                            opacity: completed && test['cta'] == 'result' ? 0.7 : 1,
                            child: MeritCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${test['title']}', style: t.titleLarge),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${asInt(test['durationMinutes'])} Mins · ${asInt(test['questionCount'])} Questions${completed && test['scorePct'] != null ? ' · Score ${asInt(test['scorePct'])}%' : ''}${test['cta'] == 'resume' && test['remainingSeconds'] != null ? ' · ${(asInt(test['remainingSeconds']) / 60).ceil()} min left' : ''}',
                                    style: t.bodySmall,
                                  ),
                                  const SizedBox(height: 10),
                                  Wrap(
                                    spacing: 8,
                                    children: [
                                      _PriceChip(
                                        test['cta'] == 'retake' && asInt(test['chargeAmount']) == 0
                                            ? 'Retake free'
                                            : '${test['priceLabel']}',
                                        gold: test['priceLabel'] != 'FREE',
                                      ),
                                      if (test['awardPool'] == true)
                                        _PriceChip('${test['awardLabel'] ?? 'Award pool'}', gold: false),
                                    ],
                                  ),
                                  const SizedBox(height: 14),
                                  test['cta'] == 'start' || test['cta'] == 'resume'
                                      ? OutlinedButton(
                                          onPressed: _busy || test['cta'] == 'ended' ? null : () => _start(test),
                                          child: Text(_ctaLabel(test)),
                                        )
                                      : SecondaryButton(
                                          label: _ctaLabel(test),
                                          onPressed: _busy || test['cta'] == 'ended' ? null : () => _start(test),
                                        ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }),
                    const SizedBox(height: 12),
                    _DailyPerformance(stats: _stats, days: days, maxBar: maxBar),
                  ] else ...[
                    const SizedBox(height: 22),
                    if (results.isEmpty)
                      const EmptyState(title: 'No results yet', body: 'Submit a quiz and your analysis will land here.')
                    else
                      ...results.map(
                        (r) => Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: MeritCard(
                            padding: const EdgeInsets.all(18),
                            onTap: () => _openAttempt('${r['testId']}', viewResultOnly: true),
                            child: LayoutBuilder(
                              builder: (context, box) {
                                final compact = box.maxWidth < 340;
                                final badgeSize = compact ? 56.0 : 72.0;
                                final badge = Container(
                                  width: badgeSize,
                                  height: badgeSize,
                                  decoration: BoxDecoration(
                                    color: AppColors.accentSoft,
                                    borderRadius: BorderRadius.circular(compact ? 16 : 22),
                                  ),
                                  child: Center(
                                    child: Text(
                                      '${asInt(r['scorePct'])}%',
                                      style: (compact ? t.titleLarge : t.headlineMedium)
                                          ?.copyWith(color: AppColors.accent),
                                    ),
                                  ),
                                );
                                final body = Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('${r['title']}', style: compact ? t.titleMedium : t.titleLarge),
                                    const SizedBox(height: 6),
                                    Text(
                                      '${r['subject'] ?? 'Mixed'} · Accuracy ${r['accuracy'] ?? '—'}%${r['rank'] != null ? ' · Rank ${r['rank']}' : ''}',
                                      style: t.bodySmall,
                                    ),
                                    const SizedBox(height: 10),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(99),
                                      child: LinearProgressIndicator(
                                        value: (asInt(r['scorePct']) / 100).clamp(0, 1),
                                        minHeight: compact ? 6 : 8,
                                        backgroundColor: AppColors.bgLow,
                                        color: AppColors.accent,
                                      ),
                                    ),
                                  ],
                                );
                                if (compact) {
                                  return Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          badge,
                                          const SizedBox(width: 12),
                                          Expanded(child: Text('${r['title']}', style: t.titleMedium)),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      Text(
                                        '${r['subject'] ?? 'Mixed'} · Accuracy ${r['accuracy'] ?? '—'}%${r['rank'] != null ? ' · Rank ${r['rank']}' : ''}',
                                        style: t.bodySmall,
                                      ),
                                      const SizedBox(height: 10),
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(99),
                                        child: LinearProgressIndicator(
                                          value: (asInt(r['scorePct']) / 100).clamp(0, 1),
                                          minHeight: 6,
                                          backgroundColor: AppColors.bgLow,
                                          color: AppColors.accent,
                                        ),
                                      ),
                                    ],
                                  );
                                }
                                return Row(
                                  children: [
                                    badge,
                                    const SizedBox(width: 16),
                                    Expanded(child: body),
                                  ],
                                );
                              },
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 12),
                    _DailyPerformance(stats: _stats, days: days, maxBar: maxBar),
                  ],
                ],
              ),
            ),
            Positioned(
              right: 20,
              bottom: 92,
              child: FloatingActionButton(
                onPressed: _openCustom,
                backgroundColor: AppColors.accent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: const Icon(Icons.add, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ConfirmEntrySheet extends StatefulWidget {
  const _ConfirmEntrySheet({
    required this.title,
    required this.charge,
    required this.onPay,
  });

  final String title;
  final int charge;
  final Future<void> Function() onPay;

  @override
  State<_ConfirmEntrySheet> createState() => _ConfirmEntrySheetState();
}

class _ConfirmEntrySheetState extends State<_ConfirmEntrySheet> {
  String? _error;
  bool _busy = false;

  Future<void> _pay() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onPay();
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _busy = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Could not start this test.';
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Confirm entry', style: t.labelMedium),
          const SizedBox(height: 8),
          Text(widget.title, style: t.headlineSmall),
          const SizedBox(height: 8),
          Text(
            'This will debit ₹${widget.charge} from your deposited wallet.',
            style: t.bodyMedium,
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            InlineError(_error!),
          ],
          const SizedBox(height: 20),
          PrimaryButton(
            label: _busy ? 'Paying…' : 'Pay ₹${widget.charge}',
            onPressed: _busy ? null : _pay,
          ),
          const SizedBox(height: 8),
          SecondaryButton(
            label: 'Cancel',
            onPressed: _busy ? null : () => Navigator.pop(context, false),
          ),
        ],
      ),
    );
  }
}

class _QuizTab extends StatelessWidget {
  const _QuizTab({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              label,
              maxLines: 1,
              style: t.titleLarge?.copyWith(
                color: selected ? AppColors.accent : AppColors.muted,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Container(
            width: 32,
            height: 4,
            decoration: BoxDecoration(
              color: selected ? AppColors.accent : Colors.transparent,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
        ],
      ),
    );
  }
}

class _PriceChip extends StatelessWidget {
  const _PriceChip(this.label, {required this.gold});
  final String label;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: gold ? AppColors.gold : const Color(0xFF4EDEA3).withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: gold ? AppColors.deep : AppColors.success,
              fontWeight: FontWeight.w800,
            ),
      ),
    );
  }
}

class _DailyPerformance extends StatelessWidget {
  const _DailyPerformance({required this.stats, required this.days, required this.maxBar});
  final Map<String, dynamic>? stats;
  final List<Map<String, dynamic>> days;
  final int maxBar;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: const Color(0xFFF2F4F6), borderRadius: BorderRadius.circular(32)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text('Daily Performance', style: t.headlineSmall)),
              Text(
                '${stats?['avgScore'] ?? '—'}',
                style: t.headlineMedium?.copyWith(color: AppColors.accent),
              ),
            ],
          ),
          Text('Last 7 days of submitted tests', style: t.bodySmall),
          const SizedBox(height: 16),
          SizedBox(
            height: 88,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final d in days)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: Container(
                        height: ((asInt(d['scorePct']) / (maxBar == 0 ? 1 : maxBar)) * 88).clamp(8, 88),
                        decoration: BoxDecoration(
                          color: AppColors.accent.withValues(alpha: d['scorePct'] == null ? 0.12 : 0.85),
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('ACCURACY', style: t.labelMedium),
                      Text('${stats?['accuracy'] ?? '—'}%', style: t.titleLarge?.copyWith(color: AppColors.success)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('WEAK AREA', style: t.labelMedium),
                      Text('${stats?['weakSubject'] ?? '—'}', style: t.titleLarge?.copyWith(color: AppColors.danger)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class TestAttemptScreen extends StatefulWidget {
  const TestAttemptScreen({
    super.key,
    required this.api,
    required this.testId,
    required this.deviceId,
    this.viewResultOnly = false,
  });

  final ApiClient api;
  final String testId;
  final String deviceId;
  final bool viewResultOnly;

  @override
  State<TestAttemptScreen> createState() => _TestAttemptScreenState();
}

class _TestAttemptScreenState extends State<TestAttemptScreen> {
  Map<String, dynamic>? _waiting;
  List<dynamic> _questions = [];
  final Map<String, String> _answers = {};
  Map<String, dynamic>? _result;
  String? _error;
  bool _attempting = false;
  bool _loadingResult = false;
  int _appSwitchCount = 0;
  int? _remaining;
  Timer? _ticker;
  AppLifecycleListener? _lifecycle;

  static const _finishedCodes = {
    'ALREADY_SUBMITTED',
    'TEST_COMPLETED',
    'NOT_JOINED',
  };

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(onStateChange: _onLifecycle);
    if (widget.viewResultOnly) {
      _loadingResult = true;
      _loadResult();
    } else {
      _poll();
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _lifecycle?.dispose();
    super.dispose();
  }

  void _startTicker() {
    _ticker?.cancel();
    if (_remaining == null) return;
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _remaining == null) return;
      if (_remaining! <= 1) {
        _ticker?.cancel();
        setState(() => _remaining = 0);
        _submit(auto: true);
        return;
      }
      setState(() => _remaining = _remaining! - 1);
    });
  }

  void _onLifecycle(AppLifecycleState state) {
    if (!_attempting || _result != null) return;
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _reportAppSwitch();
    }
  }

  Future<void> _reportAppSwitch() async {
    try {
      final res = await widget.api.request(
        'POST',
        '/api/v1/tests/app-switch',
        auth: true,
        body: {'testId': widget.testId, 'deviceId': widget.deviceId},
      );
      final data = res['data'] as Map<String, dynamic>?;
      if (data != null && mounted) {
        setState(() => _appSwitchCount = (data['appSwitchCount'] as num?)?.toInt() ?? _appSwitchCount);
      }
    } catch (_) {}
  }

  Future<bool> _loadResult() async {
    try {
      final res = await widget.api.request('GET', '/api/v1/tests/${widget.testId}/result', auth: true);
      if (!mounted) return false;
      setState(() {
        _result = res['data'] as Map<String, dynamic>;
        _error = null;
        _loadingResult = false;
      });
      return true;
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _loadingResult = false;
          if (widget.viewResultOnly) _error = e.message;
        });
      }
      return false;
    }
  }

  Future<void> _poll() async {
    if (await _loadResult()) return;
    try {
      final wait =
          await widget.api.request('GET', '/api/v1/tests/${widget.testId}/waiting-room', auth: true);
      final data = wait['data'] as Map<String, dynamic>;
      if (!mounted) return;
      setState(() => _waiting = data);
      if (data['alreadySubmitted'] == true) {
        await _loadResult();
        return;
      }
      if (data['canStart'] == true && !_attempting && _result == null) {
        try {
          final session = await widget.api.request(
            'GET',
            '/api/v1/tests/${widget.testId}/session?deviceId=${Uri.encodeComponent(widget.deviceId)}',
            auth: true,
          );
          final sessionData = session['data'] as Map<String, dynamic>;
          if (!mounted) return;
          final saved = sessionData['answers'];
          if (saved is Map) {
            saved.forEach((key, value) {
              if (value != null) _answers['$key'] = '$value';
            });
          }
          setState(() {
            _attempting = true;
            _questions = sessionData['questions'] as List<dynamic>? ?? [];
            _appSwitchCount = (sessionData['appSwitchCount'] as num?)?.toInt() ?? 0;
            _remaining = (sessionData['remainingSeconds'] as num?)?.toInt();
          });
          _startTicker();
        } on ApiException catch (e) {
          if (_finishedCodes.contains(e.code) && await _loadResult()) return;
          rethrow;
        }
      } else if (_result == null && data['canStart'] != true) {
        Future.delayed(const Duration(seconds: 3), _poll);
      }
    } on ApiException catch (e) {
      if (_finishedCodes.contains(e.code) && await _loadResult()) return;
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _select(String id, String option) async {
    setState(() => _answers[id] = option);
    try {
      await widget.api.request(
        'PATCH',
        '/api/v1/tests/${widget.testId}/answers',
        auth: true,
        body: {'mcqId': id, 'selectedOption': option, 'deviceId': widget.deviceId},
      );
    } catch (_) {}
  }

  Future<void> _submit({bool auto = false}) async {
    try {
      final body = {
        'answers': _questions.map((q) {
          final m = q as Map<String, dynamic>;
          return {'mcqId': m['id'], 'selectedOption': _answers[m['id'] as String]};
        }).toList(),
        'deviceId': widget.deviceId,
        'appSwitchCount': _appSwitchCount,
        'autoSubmit': auto,
      };
      final res =
          await widget.api.request('POST', '/api/v1/tests/${widget.testId}/submit', auth: true, body: body);
      setState(() => _result = res['data'] as Map<String, dynamic>);
      if (mounted) showRewardsToast(context, _result?['rewards'] as Map<String, dynamic>?);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;

    return PopScope(
      canPop: !_attempting || _result != null || widget.viewResultOnly,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final ok = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Leave test?'),
            content: const Text(
              'Your answers are saved. The timer keeps running. Resume from Quiz anytime.',
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Stay')),
              TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Leave')),
            ],
          ),
        );
        if (ok == true && mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
      body: AppAtmosphere(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 20, 0),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
                    ),
                    Expanded(
                      child: Text(
                        _result?['title']?.toString() ??
                            _waiting?['title']?.toString() ??
                            (widget.viewResultOnly ? 'Analysis' : 'Live test'),
                        style: t.headlineSmall,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (_attempting && _result == null && _remaining != null)
                      Text(
                        '${(_remaining! ~/ 60).toString().padLeft(2, '0')}:${(_remaining! % 60).toString().padLeft(2, '0')}',
                        style: t.titleLarge?.copyWith(color: AppColors.accent),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final w = constraints.maxWidth;
                    final pad = w < 380 ? 14.0 : w > 720 ? 28.0 : 20.0;
                    return Align(
                      alignment: Alignment.topCenter,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 920),
                        child: Padding(
                          padding: EdgeInsets.fromLTRB(pad, 12, pad, 20),
                          child: _result != null
                              ? FadeRise(
                                  child: _ResultAnalysis(
                                    result: _result!,
                                    onDone: () => Navigator.of(context).maybePop(),
                                  ),
                                )
                              : widget.viewResultOnly
                                  ? FadeRise(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const SizedBox(height: 12),
                                          Text('Analysis', style: t.labelMedium),
                                          const SizedBox(height: 16),
                                          if (_loadingResult)
                                            const Padding(
                                              padding: EdgeInsets.only(top: 24),
                                              child: Center(child: CircularProgressIndicator()),
                                            )
                                          else if (_error != null)
                                            InlineError(_error!),
                                          const Spacer(),
                                          SecondaryButton(
                                            label: 'Back',
                                            onPressed: () => Navigator.of(context).maybePop(),
                                          ),
                                        ],
                                      ),
                                    )
                                  : !_attempting
                                      ? FadeRise(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Spacer(),
                                              Text('Starts in', style: t.bodySmall),
                                              const SizedBox(height: 8),
                                              Text(
                                                '${_waiting?['countdownSeconds'] ?? '—'}',
                                                style: t.displayLarge?.copyWith(
                                                  fontFeatures: const [FontFeature.tabularFigures()],
                                                ),
                                              ),
                                              Text('seconds', style: t.bodyMedium),
                                              const SizedBox(height: 12),
                                              const Text('Stay on this screen. Leaving may be flagged.'),
                                              if (_error != null) ...[
                                                const SizedBox(height: 16),
                                                InlineError(_error!),
                                              ],
                                              const Spacer(flex: 2),
                                            ],
                                          ),
                                        )
                                      : ListView(
                                          children: [
                                            const Padding(
                                              padding: EdgeInsets.only(bottom: 16),
                                              child: Text(
                                                'Answers save as you pick. If you leave, resume from Quiz — the timer keeps running.',
                                              ),
                                            ),
                                            if (_appSwitchCount > 0)
                                              Padding(
                                                padding: const EdgeInsets.only(bottom: 12),
                                                child: StatusChip(
                                                  'App switches: $_appSwitchCount',
                                                  tone: StatusTone.danger,
                                                ),
                                              ),
                                            ..._questions.map((raw) {
                                              final q = raw as Map<String, dynamic>;
                                              final id = q['id'] as String;
                                              return Padding(
                                                padding: const EdgeInsets.only(bottom: 28),
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      q['question']?.toString() ?? '',
                                                      style: t.headlineSmall?.copyWith(height: 1.4),
                                                    ),
                                                    const SizedBox(height: 14),
                                                    ...['A', 'B', 'C', 'D'].map((o) {
                                                      final selected = _answers[id] == o;
                                                      return Padding(
                                                        padding: const EdgeInsets.only(bottom: 8),
                                                        child: InkWell(
                                                          borderRadius: BorderRadius.circular(AppRadii.md),
                                                          onTap: () => _select(id, o),
                                                          child: AnimatedContainer(
                                                            duration: const Duration(milliseconds: 150),
                                                            padding: const EdgeInsets.all(14),
                                                            decoration: BoxDecoration(
                                                              color: selected
                                                                  ? AppColors.accentSoft
                                                                  : AppColors.bgElevated,
                                                              borderRadius: BorderRadius.circular(AppRadii.md),
                                                              border: Border.all(
                                                                color: selected ? AppColors.accent : AppColors.line,
                                                              ),
                                                            ),
                                                            child: Row(
                                                              children: [
                                                                Text(
                                                                  o,
                                                                  style: t.titleMedium?.copyWith(
                                                                    color: AppColors.accent,
                                                                  ),
                                                                ),
                                                                const SizedBox(width: 12),
                                                                Expanded(
                                                                  child: Text(
                                                                    q['option$o']?.toString() ?? '',
                                                                    style: t.bodyLarge,
                                                                  ),
                                                                ),
                                                              ],
                                                            ),
                                                          ),
                                                        ),
                                                      );
                                                    }),
                                                  ],
                                                ),
                                              );
                                            }),
                                            PrimaryButton(label: 'Submit attempt', onPressed: _submit),
                                            if (_error != null) ...[
                                              const SizedBox(height: 12),
                                              InlineError(_error!),
                                            ],
                                          ],
                                        ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }
}

class _ResultAnalysis extends StatelessWidget {
  const _ResultAnalysis({required this.result, required this.onDone});

  final Map<String, dynamic> result;
  final VoidCallback onDone;

  String _timeLabel() {
    final ms = asInt(result['timeTakenMs']);
    if (ms <= 0) return '—';
    final d = Duration(milliseconds: ms);
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '${m}m ${s.toString().padLeft(2, '0')}s';
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final award = result['award'];
    final awardMap = award is Map ? Map<String, dynamic>.from(award) : null;
    final scorePct = asInt(result['scorePct']);
    final accuracy = result['accuracy'] == null ? null : asInt(result['accuracy']);
    final subject = result['subject']?.toString();
    final correct = asInt(result['correctCount']);
    final incorrect = asInt(result['incorrectCount']);
    final skipped = asInt(result['skippedCount']);
    final total = correct + incorrect + skipped;
    final ring = (scorePct / 100).clamp(0.0, 1.0);

    return LayoutBuilder(
      builder: (context, box) {
        final w = box.maxWidth;
        final compact = w < 380;
        final wide = w >= 700;
        final ringSize = (compact ? 132.0 : wide ? 196.0 : 168.0).clamp(120.0, w * 0.48);
        final scoreSize = compact ? 34.0 : wide ? 48.0 : 42.0;
        final heroPad = compact ? 18.0 : 28.0;
        final gap = compact ? 10.0 : 12.0;

        final hero = Container(
          width: double.infinity,
          padding: EdgeInsets.fromLTRB(heroPad, compact ? 22 : 28, heroPad, compact ? 24 : 32),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(compact ? AppRadii.lg : AppRadii.hero),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.deep, AppColors.deepMid, AppColors.accent],
            ),
            boxShadow: AppShadows.lift,
          ),
          child: Column(
            children: [
              Text(
                'YOUR SCORE',
                style: t.labelMedium?.copyWith(color: Colors.white70, letterSpacing: 1.6),
              ),
              SizedBox(height: compact ? 16 : 22),
              SizedBox(
                width: ringSize,
                height: ringSize,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Positioned.fill(
                      child: CircularProgressIndicator(
                        value: ring,
                        strokeWidth: compact ? 10 : 14,
                        strokeCap: StrokeCap.round,
                        backgroundColor: Colors.white24,
                        color: AppColors.gold,
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '$scorePct%',
                          style: t.displayLarge?.copyWith(
                            color: Colors.white,
                            fontSize: scoreSize,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                        Text(
                          'Marks ${result['score'] ?? '—'}',
                          style: t.bodyMedium?.copyWith(color: Colors.white70),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              SizedBox(height: compact ? 14 : 22),
              if (subject != null && subject.isNotEmpty && subject != 'null')
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(subject.toUpperCase(), style: t.labelMedium?.copyWith(color: Colors.white)),
                ),
              const SizedBox(height: 10),
              Text(
                [
                  if (accuracy != null) 'Accuracy $accuracy%',
                  'Time ${_timeLabel()}',
                  if (total > 0) '$total questions',
                ].join('  ·  '),
                style: t.bodyMedium?.copyWith(color: Colors.white70),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        );

        Widget statsGrid() {
          final tiles = [
            _stat('Correct', correct, AppColors.success, AppColors.successSoft, compact: compact),
            _stat('Incorrect', incorrect, AppColors.danger, AppColors.dangerSoft, compact: compact),
            _stat('Skipped', skipped, AppColors.inkSoft, AppColors.bgLow, compact: compact),
            _stat('Rank', result['rank'] ?? '—', AppColors.accent, AppColors.accentSoft, compact: compact),
          ];
          final cols = wide ? 4 : 2;
          return Column(
            children: [
              for (var row = 0; row < tiles.length / cols; row++) ...[
                if (row > 0) SizedBox(height: gap),
                Row(
                  children: [
                    for (var col = 0; col < cols; col++) ...[
                      if (col > 0) SizedBox(width: gap),
                      Expanded(child: tiles[row * cols + col]),
                    ],
                  ],
                ),
              ],
            ],
          );
        }

        final accuracyCard = Container(
          padding: EdgeInsets.all(compact ? 16 : 20),
          decoration: BoxDecoration(
            color: AppColors.bgElevated,
            borderRadius: BorderRadius.circular(AppRadii.lg),
            boxShadow: AppShadows.card,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text('Accuracy', style: compact ? t.titleMedium : t.titleLarge)),
                  Text(
                    accuracy != null ? '$accuracy%' : '—',
                    style: (compact ? t.titleLarge : t.headlineMedium)?.copyWith(color: AppColors.success),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: ((accuracy ?? 0) / 100).clamp(0.0, 1.0),
                  minHeight: compact ? 8 : 12,
                  backgroundColor: AppColors.bgLow,
                  color: AppColors.success,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: Text('Time taken', style: t.bodyMedium)),
                  Text(_timeLabel(), style: compact ? t.titleMedium : t.titleLarge),
                ],
              ),
            ],
          ),
        );

        final awardCard = awardMap == null
            ? null
            : Container(
                width: double.infinity,
                padding: EdgeInsets.all(compact ? 16 : 20),
                decoration: BoxDecoration(
                  color: AppColors.goldSoft,
                  borderRadius: BorderRadius.circular(AppRadii.lg),
                ),
                child: Text(
                  'Award ₹${awardMap['amount']} · ${awardMap['status']}',
                  style: t.titleLarge?.copyWith(color: AppColors.deep),
                ),
              );

        return ListView(
          padding: const EdgeInsets.only(bottom: 8),
          children: [
            if (wide)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 5, child: hero),
                  const SizedBox(width: 20),
                  Expanded(
                    flex: 6,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('BREAKDOWN', style: t.labelMedium),
                        const SizedBox(height: 12),
                        statsGrid(),
                        const SizedBox(height: 16),
                        accuracyCard,
                        if (awardCard != null) ...[const SizedBox(height: 16), awardCard],
                      ],
                    ),
                  ),
                ],
              )
            else ...[
              hero,
              SizedBox(height: compact ? 16 : 22),
              Text('BREAKDOWN', style: t.labelMedium),
              const SizedBox(height: 12),
              statsGrid(),
              SizedBox(height: compact ? 16 : 22),
              accuracyCard,
              if (awardCard != null) ...[const SizedBox(height: 16), awardCard],
            ],
            const SizedBox(height: 24),
            PrimaryButton(label: 'Done', onPressed: onDone),
          ],
        );
      },
    );
  }

  Widget _stat(String label, dynamic value, Color ink, Color bg, {required bool compact}) {
    return Container(
      padding: EdgeInsets.fromLTRB(compact ? 12 : 18, compact ? 14 : 18, compact ? 12 : 18, compact ? 14 : 20),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: compact ? 10 : 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
              color: ink,
            ),
          ),
          SizedBox(height: compact ? 4 : 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              '$value',
              style: TextStyle(
                fontSize: compact ? 24 : 32,
                fontWeight: FontWeight.w800,
                height: 1.1,
                color: ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
