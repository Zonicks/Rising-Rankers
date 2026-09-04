import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/skeleton.dart';
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
  bool _coachShown = false;
  int _shakeToken = 0;
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
        if (push && _card != null)
          _history.add(Map<String, dynamic>.from(_card!));
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

  void _goNext() {
    if (_busy || _card == null) return;
    HapticFeedback.mediumImpact();
    _loadNext(excludeId: _card?['id']?.toString(), push: true);
  }

  void _goPrevious() {
    if (_busy) return;
    if (_history.isEmpty) {
      HapticFeedback.selectionClick();
      setState(() => _shakeToken++);
      return;
    }
    HapticFeedback.mediumImpact();
    _previous();
  }

  void _flip() {
    if (_busy || _card == null) return;
    HapticFeedback.lightImpact();
    setState(() => _flipped = !_flipped);
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
      if (mounted)
        showRewardsToast(context, data['rewards'] as Map<String, dynamic>?);
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
    final pill =
        _card?['chapterTitle']?.toString() ??
        _card?['subject']?.toString() ??
        'Card';
    final pct = _dailyGoal == 0
        ? 0.0
        : (_ratedToday / _dailyGoal).clamp(0.0, 1.0);
    final cardId = _card?['id']?.toString() ?? '';
    final showCoach = _card != null && !_coachShown;

    return SafeArea(
      child: FadeRise(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            Navigator.of(context).canPop() ? 32 : 120,
          ),
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
                subtitle:
                    'Tap the center to flip. Swipe to browse — swipes do not rate.',
              ),
              const SizedBox(height: 18),
              if (_card == null && _error == null)
                const Expanded(
                  child: SingleChildScrollView(child: FlashcardsSkeleton()),
                )
              else ...[
                Row(
                  children: [
                    Text('DAILY GOAL', style: t.labelMedium),
                    const Spacer(),
                    Text(
                      '$_ratedToday/$_dailyGoal',
                      style: t.titleLarge?.copyWith(
                        color: AppColors.accent,
                        fontWeight: FontWeight.w800,
                      ),
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
                const SizedBox(height: 6),
                Text(
                  'Easy or Hard counts. Swipes only browse.',
                  style: t.bodySmall,
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
                if (_card != null)
                  Expanded(
                    child: _SwipeDeck(
                      key: ValueKey(cardId),
                      enabled: !_busy,
                      canPrevious: _history.isNotEmpty,
                      showCoach: showCoach,
                      shakeToken: _shakeToken,
                      flipped: _flipped,
                      pill: pill,
                      face: face,
                      onFlip: _flip,
                      onNext: _goNext,
                      onPrevious: _goPrevious,
                      onCoachSeen: () {
                        if (!_coachShown) _coachShown = true;
                      },
                    ),
                  ),
                if (_card != null) ...[
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      _NavChip(
                        label: 'Previous',
                        enabled: !_busy && _history.isNotEmpty,
                        onTap: _goPrevious,
                      ),
                      Expanded(
                        child: Text(
                          '${_history.length + 1} this session',
                          textAlign: TextAlign.center,
                          style: t.bodySmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      _NavChip(label: 'Next', enabled: !_busy, onTap: _goNext),
                    ],
                  ),
                  const SizedBox(height: 12),
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
                    _freeLeft > 0
                        ? '$_freeLeft free ratings left today'
                        : 'Free ratings used today',
                    style: t.bodySmall,
                  ),
                ],
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
        constraints: const BoxConstraints(minHeight: 48),
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: color,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              hint.toUpperCase(),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _NavChip extends StatelessWidget {
  const _NavChip({
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = enabled
        ? AppColors.deepMid
        : AppColors.muted.withValues(alpha: 0.45);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(99),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: fg,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

class _SwipeDeck extends StatefulWidget {
  const _SwipeDeck({
    super.key,
    required this.enabled,
    required this.canPrevious,
    required this.showCoach,
    required this.shakeToken,
    required this.flipped,
    required this.pill,
    required this.face,
    required this.onFlip,
    required this.onNext,
    required this.onPrevious,
    required this.onCoachSeen,
  });

  final bool enabled;
  final bool canPrevious;
  final bool showCoach;
  final int shakeToken;
  final bool flipped;
  final String pill;
  final String face;
  final VoidCallback onFlip;
  final VoidCallback onNext;
  final VoidCallback onPrevious;
  final VoidCallback onCoachSeen;

  @override
  State<_SwipeDeck> createState() => _SwipeDeckState();
}

class _SwipeDeckState extends State<_SwipeDeck> with TickerProviderStateMixin {
  static const _distance = 88.0;
  static const _velocity = 400.0;

  double _drag = 0;
  bool _committed = false;
  VoidCallback? _onSettleDone;

  late final AnimationController _settle = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 220),
  );
  late Animation<double> _settleAnim = const AlwaysStoppedAnimation(0);
  late final AnimationController _shake = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 280),
  );
  late final Animation<double> _shakeAnim = TweenSequence<double>([
    TweenSequenceItem(tween: Tween(begin: 0, end: -10), weight: 1),
    TweenSequenceItem(tween: Tween(begin: -10, end: 10), weight: 2),
    TweenSequenceItem(tween: Tween(begin: 10, end: -6), weight: 2),
    TweenSequenceItem(tween: Tween(begin: -6, end: 0), weight: 2),
  ]).animate(CurvedAnimation(parent: _shake, curve: Curves.easeOut));
  late final bool _showCoach = widget.showCoach;

  @override
  void initState() {
    super.initState();
    _settle.addListener(() {
      if (!mounted) return;
      setState(() => _drag = _settleAnim.value);
    });
    _settle.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) _onSettleDone?.call();
    });
    _shake.addListener(() {
      if (mounted) setState(() {});
    });
    if (_showCoach) {
      WidgetsBinding.instance.addPostFrameCallback((_) => widget.onCoachSeen());
    }
  }

  @override
  void didUpdateWidget(covariant _SwipeDeck oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.shakeToken != oldWidget.shakeToken) {
      _shake.forward(from: 0);
    }
    if (!oldWidget.enabled && widget.enabled && _committed) {
      _committed = false;
      _animateTo(0);
    }
  }

  @override
  void dispose() {
    _settle.dispose();
    _shake.dispose();
    super.dispose();
  }

  void _animateTo(double target, {VoidCallback? onDone, int ms = 220}) {
    _onSettleDone = onDone;
    _settle
      ..stop()
      ..duration = Duration(milliseconds: ms);
    _settleAnim = Tween<double>(
      begin: _drag,
      end: target,
    ).animate(CurvedAnimation(parent: _settle, curve: Curves.easeOutCubic));
    _settle.forward(from: 0);
  }

  void _onDragStart(DragStartDetails _) {
    if (!widget.enabled || _committed) return;
    _settle.stop();
    _onSettleDone = null;
  }

  void _onDragUpdate(DragUpdateDetails details) {
    if (!widget.enabled || _committed) return;
    setState(() => _drag += details.delta.dx);
  }

  void _onDragEnd(DragEndDetails details) {
    if (!widget.enabled || _committed) return;
    final v = details.velocity.pixelsPerSecond.dx;
    final byDistanceNext = _drag >= _distance;
    final byDistancePrev = _drag <= -_distance;
    final byVelNext = v > _velocity;
    final byVelPrev = v < -_velocity;

    var dir = 0;
    if (byVelNext) {
      dir = 1;
    } else if (byVelPrev) {
      dir = -1;
    } else if (byDistanceNext) {
      dir = 1;
    } else if (byDistancePrev) {
      dir = -1;
    }

    if (dir == 0) {
      _animateTo(0);
      return;
    }

    final width = MediaQuery.sizeOf(context).width;
    if (dir > 0) {
      _commit(width * 1.15, widget.onNext);
    } else if (!widget.canPrevious) {
      _shake.forward(from: 0);
      HapticFeedback.selectionClick();
      _animateTo(0);
    } else {
      _commit(-width * 1.15, widget.onPrevious);
    }
  }

  void _commit(double target, VoidCallback action) {
    _committed = true;
    _animateTo(target, ms: 260, onDone: action);
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final x = _drag + _shakeAnim.value;
    final rot = (x / 28).clamp(-8.0, 8.0) * math.pi / 180;
    final peek = 10.0 - x * 0.12;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          child: IgnorePointer(
            child: Transform.translate(
              offset: Offset(peek + 6, 18),
              child: Transform.scale(
                scale: 0.94,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.deep.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(AppRadii.xl),
                  ),
                ),
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: IgnorePointer(
            child: Transform.translate(
              offset: Offset(peek, 10),
              child: Transform.scale(
                scale: 0.97,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.deepMid.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(AppRadii.xl),
                  ),
                ),
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: widget.enabled && !_committed ? widget.onFlip : null,
            onHorizontalDragStart: _onDragStart,
            onHorizontalDragUpdate: _onDragUpdate,
            onHorizontalDragEnd: _onDragEnd,
            child: Transform.translate(
              offset: Offset(x, 0),
              child: Transform.rotate(
                angle: rot,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.bgElevated,
                    borderRadius: BorderRadius.circular(AppRadii.xl),
                    border: Border.all(color: AppColors.line),
                    boxShadow: AppShadows.lift,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(28, 24, 28, 22),
                    child: Column(
                      children: [
                        Align(
                          alignment: Alignment.topLeft,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.goldSoft,
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text(
                              widget.pill.toUpperCase(),
                              style: t.bodySmall?.copyWith(
                                color: AppColors.deepMid,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.6,
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: Center(
                            child: AnimatedSwitcher(
                              duration: const Duration(milliseconds: 180),
                              switchInCurve: Curves.easeOut,
                              switchOutCurve: Curves.easeIn,
                              transitionBuilder: (child, anim) =>
                                  FadeTransition(
                                    opacity: anim,
                                    child: ScaleTransition(
                                      scale: Tween<double>(
                                        begin: 0.96,
                                        end: 1,
                                      ).animate(anim),
                                      child: child,
                                    ),
                                  ),
                              child: Text(
                                widget.face,
                                key: ValueKey(
                                  '${widget.flipped}_${widget.face}',
                                ),
                                textAlign: TextAlign.center,
                                style: t.headlineMedium?.copyWith(height: 1.35),
                              ),
                            ),
                          ),
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.flip_rounded,
                              size: 16,
                              color: AppColors.muted,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              widget.flipped
                                  ? 'Answer · tap center to flip'
                                  : 'Prompt · tap center to flip',
                              style: t.bodySmall,
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        _PageDots(canPrevious: widget.canPrevious, drag: x),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        if (_showCoach)
          const Positioned(
            left: 0,
            right: 0,
            bottom: 56,
            child: IgnorePointer(child: _SwipeCoach()),
          ),
      ],
    );
  }
}

class _PageDots extends StatelessWidget {
  const _PageDots({required this.canPrevious, required this.drag});

  final bool canPrevious;
  final double drag;

  @override
  Widget build(BuildContext context) {
    final t = (drag / 88).clamp(-1.0, 1.0);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _dot(
          size: t < -0.25 ? 8 : 6,
          color: canPrevious
              ? AppColors.deepMid.withValues(
                  alpha: t < 0 ? 0.45 + 0.4 * -t : 0.28,
                )
              : AppColors.line.withValues(alpha: 0.7),
        ),
        const SizedBox(width: 7),
        _dot(
          width: 18,
          height: 7,
          color: AppColors.gold.withValues(alpha: 1 - t.abs() * 0.2),
        ),
        const SizedBox(width: 7),
        _dot(
          size: t > 0.25 ? 8 : 6,
          color: AppColors.deepMid.withValues(
            alpha: t > 0 ? 0.45 + 0.4 * t : 0.28,
          ),
        ),
      ],
    );
  }

  Widget _dot({
    double size = 6,
    double? width,
    double? height,
    required Color color,
  }) {
    return Container(
      width: width ?? size,
      height: height ?? size,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(99),
      ),
    );
  }
}

class _SwipeCoach extends StatefulWidget {
  const _SwipeCoach();

  @override
  State<_SwipeCoach> createState() => _SwipeCoachState();
}

class _SwipeCoachState extends State<_SwipeCoach>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fade = Tween<double>(begin: 1, end: 0).animate(
      CurvedAnimation(
        parent: _c,
        curve: const Interval(0.35, 1, curve: Curves.easeOut),
      ),
    );
    return FadeTransition(
      opacity: fade,
      child: Text(
        '‹   swipe   ›',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          color: AppColors.gold,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.4,
        ),
      ),
    );
  }
}
