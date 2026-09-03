import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';

class FlashcardsScreen extends StatefulWidget {
  const FlashcardsScreen({
    super.key,
    required this.api,
    this.chapterId,
    this.subjectId,
  });

  final ApiClient api;
  final String? chapterId;
  final String? subjectId;

  @override
  State<FlashcardsScreen> createState() => _FlashcardsScreenState();
}

class _FlashcardsScreenState extends State<FlashcardsScreen> {
  Map<String, dynamic>? _card;
  final List<Map<String, dynamic>> _history = [];
  int _ratedToday = 0;
  int _dailyGoal = 50;
  int _freeLeft = 0;
  bool _flipped = false;
  bool _busy = false;
  String? _error;
  String? _errorCode;
  double? _unlockPrice;

  String _qs({String? excludeId}) {
    final p = <String, String>{};
    if (excludeId != null) p['excludeId'] = excludeId;
    if (widget.chapterId != null) p['chapterId'] = widget.chapterId!;
    if (widget.subjectId != null) p['subjectId'] = widget.subjectId!;
    if (p.isEmpty) return '';
    return '?${p.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&')}';
  }

  @override
  void initState() {
    super.initState();
    _loadNext();
  }

  Future<void> _loadNext({String? excludeId, bool push = false}) async {
    setState(() {
      _busy = true;
      _error = null;
      _unlockPrice = null;
    });
    try {
      final res = await widget.api.request(
        'GET',
        '/api/v1/flashcards/next${_qs(excludeId: excludeId)}',
        auth: true,
      );
      final data = res['data'] as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        if (push && _card != null) _history.add(Map<String, dynamic>.from(_card!));
        _card = data['card'] as Map<String, dynamic>;
        final quota = data['quota'] as Map<String, dynamic>? ?? {};
        final goal = data['goal'] as Map<String, dynamic>? ?? {};
        _freeLeft = (quota['freeLeft'] as num?)?.toInt() ?? 0;
        _ratedToday = (goal['ratedToday'] as num?)?.toInt() ?? 0;
        _dailyGoal = (goal['dailyGoal'] as num?)?.toInt() ?? 50;
        _flipped = false;
        _busy = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
        _errorCode = e.code;
        if (e.code == 'NO_CONTENT') _card = null;
        if (e.code == 'QUOTA_EXCEEDED' && e.details is Map) {
          _unlockPrice = (e.details['unlockPrice'] as num?)?.toDouble();
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.toString();
      });
    }
  }

  void _previous() {
    if (_history.isEmpty) return;
    setState(() {
      _card = _history.removeLast();
      _flipped = false;
      _error = null;
    });
  }

  Future<void> _review(String rating) async {
    if (_card == null || _busy) return;
    final id = _card!['id']?.toString();
    if (id == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await widget.api.request(
        'POST',
        '/api/v1/flashcards/$id/review',
        auth: true,
        body: {'rating': rating},
      );
      final data = res['data'] as Map<String, dynamic>;
      final goal = data['goal'] as Map<String, dynamic>? ?? {};
      setState(() {
        _ratedToday = (goal['ratedToday'] as num?)?.toInt() ?? _ratedToday;
        _dailyGoal = (goal['dailyGoal'] as num?)?.toInt() ?? _dailyGoal;
      });
      if (mounted) showRewardsToast(context, data['rewards'] as Map<String, dynamic>?);
      await _loadNext(excludeId: id, push: true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
        if (e.code == 'QUOTA_EXCEEDED' && e.details is Map) {
          _unlockPrice = (e.details['unlockPrice'] as num?)?.toDouble();
        }
      });
    }
  }

  Future<void> _unlock() async {
    setState(() => _busy = true);
    try {
      await widget.api.request('POST', '/api/v1/flashcards/unlock', auth: true);
      await _loadNext(excludeId: _card?['id']?.toString());
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final face = _flipped
        ? (_card?['back']?.toString() ?? '')
        : (_card?['front']?.toString() ?? '');
    final pill = _card?['chapterTitle']?.toString() ??
        _card?['subject']?.toString() ??
        'Card';
    final pct = _dailyGoal == 0 ? 0.0 : (_ratedToday / _dailyGoal).clamp(0.0, 1.0);

    return SafeArea(
      child: FadeRise(
        child: Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, Navigator.of(context).canPop() ? 32 : 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (Navigator.of(context).canPop())
                Align(
                  alignment: Alignment.centerLeft,
                  child: IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ),
              ScreenHeader(
                overline: 'Practice',
                title: 'Flashcards',
                subtitle: 'Tap to flip · swipe to browse · Easy / Hard to rate',
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Text('DAILY GOAL', style: t.labelMedium),
                  const Spacer(),
                  Text(
                    '$_ratedToday/$_dailyGoal',
                    style: t.titleLarge?.copyWith(color: AppColors.accent, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: pct,
                  minHeight: 6,
                  backgroundColor: AppColors.line,
                  color: AppColors.accent,
                ),
              ),
              const SizedBox(height: 20),
              if (_error != null) ...[
                InlineError(_error!),
                if (_unlockPrice != null) ...[
                  const SizedBox(height: 12),
                  PrimaryButton(
                    label: 'Unlock more · ₹$_unlockPrice',
                    busy: _busy,
                    onPressed: _unlock,
                  ),
                ],
                if (_errorCode == 'FORBIDDEN') ...[
                  const SizedBox(height: 12),
                  SecondaryButton(
                    label: 'Find this book in Search',
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
                const SizedBox(height: 12),
              ],
              if (_busy && _card == null)
                const Expanded(child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
              if (_card != null)
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _flipped = !_flipped),
                    onHorizontalDragEnd: (details) {
                      final v = details.primaryVelocity ?? 0;
                      if (v > 280) {
                        _loadNext(excludeId: _card?['id']?.toString(), push: true);
                      } else if (v < -280) {
                        _previous();
                      }
                    },
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Positioned.fill(
                          child: Transform.translate(
                            offset: const Offset(0, 16),
                            child: Transform.scale(
                              scale: 0.94,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: AppColors.line,
                                  borderRadius: BorderRadius.circular(AppRadii.xl),
                                ),
                              ),
                            ),
                          ),
                        ),
                        Positioned.fill(
                          child: Transform.translate(
                            offset: const Offset(0, 8),
                            child: Transform.scale(
                              scale: 0.97,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F3FB),
                                  borderRadius: BorderRadius.circular(AppRadii.xl),
                                ),
                              ),
                            ),
                          ),
                        ),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(28),
                          decoration: BoxDecoration(
                            color: AppColors.bgElevated,
                            borderRadius: BorderRadius.circular(AppRadii.xl),
                            border: Border.all(color: AppColors.line),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.accent.withValues(alpha: 0.12),
                                blurRadius: 32,
                                offset: const Offset(0, 12),
                              ),
                            ],
                          ),
                          child: Column(
                            children: [
                              Align(
                                alignment: Alignment.topLeft,
                                child: StatusChip(pill, tone: StatusTone.accent),
                              ),
                              Expanded(
                                child: Center(
                                  child: Text(
                                    face,
                                    textAlign: TextAlign.center,
                                    style: t.headlineMedium?.copyWith(height: 1.35),
                                  ),
                                ),
                              ),
                              Text(
                                _flipped ? 'Answer · tap to flip' : 'Prompt · tap to flip',
                                style: t.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (_card != null) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _rateButton(
                        label: 'Hard',
                        hint: '1 day',
                        color: AppColors.danger,
                        bg: AppColors.dangerSoft,
                        onTap: () => _review('HARD'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _rateButton(
                        label: 'Easy',
                        hint: '3 days',
                        color: AppColors.success,
                        bg: AppColors.successSoft,
                        onTap: () => _review('EASY'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  _freeLeft > 0 ? '$_freeLeft free ratings left today' : 'Free ratings used today',
                  style: t.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _rateButton({
    required String label,
    required String hint,
    required Color color,
    required Color bg,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: _busy ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Text(label, style: TextStyle(fontWeight: FontWeight.w800, color: color, fontSize: 16)),
            const SizedBox(height: 2),
            Text(hint.toUpperCase(), style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
