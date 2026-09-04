import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../../core/theme.dart';

class OnboardingDeckScene extends StatelessWidget {
  const OnboardingDeckScene({
    super.key,
    this.parallax = 0,
    this.compact = false,
  });

  final double parallax;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final w = compact ? 168.0 : 228.0;
    final h = compact ? 188.0 : 252.0;
    return Transform.translate(
      offset: Offset(parallax, 0),
      child: SizedBox(
        width: w + 18,
        height: h + 16,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Transform.translate(
              offset: Offset(compact ? 10 : 16, compact ? 12 : 18),
              child: Transform.rotate(
                angle: 0.07,
                child: _plate(w, h, AppColors.deep.withValues(alpha: 0.35)),
              ),
            ),
            Transform.translate(
              offset: Offset(compact ? 5 : 8, compact ? 6 : 10),
              child: Transform.rotate(
                angle: 0.03,
                child: _plate(w, h, AppColors.deepMid.withValues(alpha: 0.55)),
              ),
            ),
            Transform.rotate(
              angle: -0.04,
              child: Container(
                width: w,
                height: h,
                padding: EdgeInsets.fromLTRB(
                  compact ? 14 : 20,
                  compact ? 14 : 20,
                  compact ? 14 : 20,
                  compact ? 12 : 16,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppRadii.xl),
                  boxShadow: AppShadows.lift,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.goldSoft,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        'PROMPT',
                        style: TextStyle(
                          fontSize: compact ? 8 : 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: AppColors.deepMid,
                        ),
                      ),
                    ),
                    SizedBox(height: compact ? 16 : 28),
                    _bar(compact ? 0.92 : 0.95),
                    const SizedBox(height: 8),
                    _bar(0.72),
                    const SizedBox(height: 8),
                    _bar(0.54),
                    const Spacer(),
                    Center(
                      child: Text(
                        '‹   swipe   ›',
                        style: TextStyle(
                          fontSize: compact ? 9 : 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.6,
                          color: AppColors.gold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _plate(double w, double h, Color color) {
    return Container(
      width: w,
      height: h,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppRadii.xl),
      ),
    );
  }

  Widget _bar(double frac) {
    return FractionallySizedBox(
      widthFactor: frac,
      child: Container(
        height: 8,
        decoration: BoxDecoration(
          color: AppColors.accentSoft,
          borderRadius: BorderRadius.circular(99),
        ),
      ),
    );
  }
}

class OnboardingLiveScene extends StatelessWidget {
  const OnboardingLiveScene({super.key, this.parallax = 0});

  final double parallax;

  @override
  Widget build(BuildContext context) {
    return Transform.translate(
      offset: Offset(parallax, 0),
      child: Container(
        width: 248,
        height: 268,
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(AppRadii.hero),
          border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
        ),
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: AppColors.gold,
                  borderRadius: BorderRadius.circular(99),
                ),
                child: const Text(
                  'LIVE',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                    color: AppColors.deep,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: 112,
              height: 112,
              child: CustomPaint(
                painter: _TimerRingPainter(progress: 0.62),
                child: const Center(
                  child: Text(
                    '08:42',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 22,
                      letterSpacing: -0.6,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '#12',
              style: TextStyle(
                color: AppColors.gold,
                fontWeight: FontWeight.w800,
                fontSize: 28,
                letterSpacing: -0.8,
              ),
            ),
            const SizedBox(height: 10),
            _rankBar(0.82),
            const SizedBox(height: 6),
            _rankBar(0.64),
            const SizedBox(height: 6),
            _rankBar(0.48),
          ],
        ),
      ),
    );
  }

  Widget _rankBar(double frac) {
    return Align(
      alignment: Alignment.centerLeft,
      child: FractionallySizedBox(
        widthFactor: frac,
        child: Container(
          height: 7,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(99),
          ),
        ),
      ),
    );
  }
}

class _TimerRingPainter extends CustomPainter {
  _TimerRingPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2 - 6;
    final track = Paint()
      ..color = Colors.white.withValues(alpha: 0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8;
    canvas.drawCircle(c, r, track);
    final sweep = Paint()
      ..shader = const SweepGradient(
        startAngle: -math.pi / 2,
        endAngle: math.pi * 1.5,
        colors: [AppColors.gold, AppColors.accent],
      ).createShader(Rect.fromCircle(center: c, radius: r))
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 8;
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r),
      -math.pi / 2,
      2 * math.pi * progress,
      false,
      sweep,
    );
  }

  @override
  bool shouldRepaint(covariant _TimerRingPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

class OnboardingAwardScene extends StatelessWidget {
  const OnboardingAwardScene({
    super.key,
    this.parallax = 0,
    this.compact = false,
  });

  final double parallax;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Transform.translate(
      offset: Offset(parallax, 0),
      child: Container(
        width: compact ? 200 : 248,
        padding: EdgeInsets.all(compact ? 18 : 24),
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
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Award balance',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.65),
                fontSize: compact ? 11 : 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '₹',
              style: TextStyle(
                color: AppColors.gold,
                fontSize: compact ? 44 : 56,
                fontWeight: FontWeight.w800,
                height: 1,
                letterSpacing: -2,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Withdraw when you win',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.55),
                fontSize: compact ? 11 : 13,
              ),
            ),
            if (!compact) ...[
              const SizedBox(height: 18),
              Row(
                children: [
                  _mini('Deposited', 'Practice'),
                  const SizedBox(width: 16),
                  _mini('Promo', 'Boosts'),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _mini(String label, String value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.45),
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }
}

class OnboardingSceneSwitcher extends StatelessWidget {
  const OnboardingSceneSwitcher({
    super.key,
    required this.index,
    this.parallax = 0,
  });

  final int index;
  final double parallax;

  @override
  Widget build(BuildContext context) {
    return switch (index) {
      1 => OnboardingLiveScene(parallax: parallax),
      2 => OnboardingAwardScene(parallax: parallax),
      _ => OnboardingDeckScene(parallax: parallax),
    };
  }
}
