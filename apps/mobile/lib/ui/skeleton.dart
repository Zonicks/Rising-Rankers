import 'package:flutter/material.dart';
import '../core/theme.dart';

bool skeletonReduceMotion(BuildContext context) =>
    MediaQuery.disableAnimationsOf(context);

class SkeletonPulse extends StatefulWidget {
  const SkeletonPulse({super.key, required this.child});

  final Widget child;

  @override
  State<SkeletonPulse> createState() => _SkeletonPulseState();
}

class _SkeletonPulseState extends State<SkeletonPulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  late final Animation<double> _opacity = Tween<double>(
    begin: 0.55,
    end: 1,
  ).animate(_c);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (skeletonReduceMotion(context)) {
      _c.stop();
      _c.value = 1;
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (skeletonReduceMotion(context)) return widget.child;
    return FadeTransition(opacity: _opacity, child: widget.child);
  }
}

class SkeletonScope extends StatelessWidget {
  const SkeletonScope({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading',
      container: true,
      child: ExcludeSemantics(child: SkeletonPulse(child: child)),
    );
  }
}

class SkeletonBone extends StatelessWidget {
  const SkeletonBone({
    super.key,
    this.width,
    this.height = 12,
    this.radius = 8,
    this.onNavy = false,
  });

  final double? width;
  final double height;
  final double radius;
  final bool onNavy;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: onNavy
            ? Colors.white.withValues(alpha: 0.15)
            : AppColors.bgHigh.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

class SkeletonChrome extends StatelessWidget {
  const SkeletonChrome({super.key});

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        SkeletonBone(width: 40, height: 40, radius: 12),
        SizedBox(width: 12),
        SkeletonBone(width: 140, height: 18, radius: 8),
        Spacer(),
        SkeletonBone(width: 56, height: 32, radius: 99),
      ],
    );
  }
}

class SkeletonHero extends StatelessWidget {
  const SkeletonHero({super.key, this.height = 200});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: height,
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
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonBone(width: 96, height: 10, radius: 99, onNavy: true),
          SizedBox(height: 14),
          SkeletonBone(width: 180, height: 22, radius: 8, onNavy: true),
          Spacer(),
          Row(
            children: [
              SkeletonBone(width: 72, height: 32, radius: 8, onNavy: true),
              Spacer(),
              SkeletonBone(width: 88, height: 12, radius: 8, onNavy: true),
            ],
          ),
          SizedBox(height: 12),
          SkeletonBone(height: 12, radius: 99, onNavy: true),
        ],
      ),
    );
  }
}

class SkeletonRow extends StatelessWidget {
  const SkeletonRow({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.bgElevated,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        boxShadow: AppShadows.card,
      ),
      child: const Row(
        children: [
          SkeletonBone(width: 48, height: 48, radius: 16),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBone(width: 64, height: 10, radius: 99),
                SizedBox(height: 8),
                SkeletonBone(width: 160, height: 16, radius: 8),
                SizedBox(height: 8),
                SkeletonBone(width: 110, height: 10, radius: 8),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class SkeletonFace extends StatelessWidget {
  const SkeletonFace({super.key, this.minHeight = 280});

  final double minHeight;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: BoxConstraints(minHeight: minHeight),
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: AppColors.bgElevated,
        borderRadius: BorderRadius.circular(AppRadii.xl),
        boxShadow: AppShadows.lift,
        border: Border.all(color: AppColors.line.withValues(alpha: 0.2)),
      ),
      child: const Column(
        children: [
          SkeletonBone(width: 72, height: 22, radius: 99),
          SizedBox(height: 36),
          SkeletonBone(width: 220, height: 22, radius: 8),
          SizedBox(height: 10),
          SkeletonBone(width: 160, height: 22, radius: 8),
          SizedBox(height: 10),
          SkeletonBone(width: 100, height: 12, radius: 8),
        ],
      ),
    );
  }
}

class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 3});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < count; i++) ...[
          if (i > 0) const SizedBox(height: 12),
          const SkeletonRow(),
        ],
      ],
    );
  }
}

class HomeSkeleton extends StatelessWidget {
  const HomeSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SkeletonChrome(),
          const SizedBox(height: 24),
          const SkeletonHero(height: 220),
          const SizedBox(height: 32),
          const SkeletonBone(width: 110, height: 18, radius: 8),
          const SizedBox(height: 14),
          Container(
            height: 92,
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.hero),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.deep, AppColors.deepMid, AppColors.accent],
              ),
            ),
            padding: const EdgeInsets.all(20),
            child: const Row(
              children: [
                SkeletonBone(width: 56, height: 56, radius: 16, onNavy: true),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SkeletonBone(
                        width: 48,
                        height: 10,
                        radius: 99,
                        onNavy: true,
                      ),
                      SizedBox(height: 8),
                      SkeletonBone(
                        width: 120,
                        height: 16,
                        radius: 8,
                        onNavy: true,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Row(
            children: [
              Expanded(child: _TileBone()),
              SizedBox(width: 12),
              Expanded(child: _TileBone()),
            ],
          ),
          const SizedBox(height: 32),
          const SkeletonRow(),
          const SizedBox(height: 32),
          const SkeletonBone(width: 140, height: 18, radius: 8),
          const SizedBox(height: 14),
          const SkeletonList(count: 3),
        ],
      ),
    );
  }
}

class _TileBone extends StatelessWidget {
  const _TileBone();

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.bgElevated,
          borderRadius: BorderRadius.circular(24),
          boxShadow: AppShadows.card,
        ),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SkeletonBone(width: 48, height: 48, radius: 12),
            Spacer(),
            SkeletonBone(width: 90, height: 14, radius: 8),
            SizedBox(height: 8),
            SkeletonBone(width: 64, height: 10, radius: 8),
          ],
        ),
      ),
    );
  }
}

class StudySkeleton extends StatelessWidget {
  const StudySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SkeletonChrome(),
          const SizedBox(height: 20),
          const SkeletonHero(height: 180),
          const SizedBox(height: 20),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.hero),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.deep, AppColors.deepMid, AppColors.accent],
              ),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBone(width: 88, height: 10, radius: 99, onNavy: true),
                SizedBox(height: 12),
                SkeletonBone(width: 200, height: 20, radius: 8, onNavy: true),
                SizedBox(height: 8),
                SkeletonBone(width: 140, height: 12, radius: 8, onNavy: true),
                SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: SkeletonBone(height: 44, radius: 16, onNavy: true),
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: SkeletonBone(height: 44, radius: 16, onNavy: true),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const SkeletonRow(),
          const SizedBox(height: 12),
          const SkeletonRow(),
        ],
      ),
    );
  }
}

class TestsSkeleton extends StatelessWidget {
  const TestsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SkeletonScope(
      child: Column(
        children: [
          SizedBox(height: 22),
          SkeletonHero(height: 220),
          SizedBox(height: 22),
          SkeletonList(count: 3),
        ],
      ),
    );
  }
}

class FlashcardsSkeleton extends StatelessWidget {
  const FlashcardsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SkeletonScope(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              SkeletonBone(width: 80, height: 10, radius: 99),
              Spacer(),
              SkeletonBone(width: 48, height: 18, radius: 8),
            ],
          ),
          SizedBox(height: 8),
          SkeletonBone(height: 6, radius: 99),
          SizedBox(height: 20),
          SkeletonFace(minHeight: 280),
          SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: SkeletonBone(height: 64, radius: 16)),
              SizedBox(width: 10),
              Expanded(child: SkeletonBone(height: 64, radius: 16)),
            ],
          ),
        ],
      ),
    );
  }
}

class McqSkeleton extends StatelessWidget {
  const McqSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SkeletonBone(height: 20, radius: 8),
          const SizedBox(height: 10),
          const SkeletonBone(width: 240, height: 20, radius: 8),
          const SizedBox(height: 24),
          for (var i = 0; i < 4; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            const SkeletonBone(height: 56, radius: 16),
          ],
        ],
      ),
    );
  }
}

class NewsSkeleton extends StatelessWidget {
  const NewsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Column(
        children: [
          Container(
            width: double.infinity,
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
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBone(width: 88, height: 22, radius: 99, onNavy: true),
                SizedBox(height: 18),
                SkeletonBone(width: 220, height: 22, radius: 8, onNavy: true),
                SizedBox(height: 8),
                SkeletonBone(width: 160, height: 22, radius: 8, onNavy: true),
                SizedBox(height: 14),
                SkeletonBone(height: 12, radius: 8, onNavy: true),
                SizedBox(height: 8),
                SkeletonBone(width: 180, height: 12, radius: 8, onNavy: true),
                SizedBox(height: 20),
                SkeletonBone(height: 44, radius: 16, onNavy: true),
              ],
            ),
          ),
          const SizedBox(height: 28),
          const SkeletonList(count: 3),
        ],
      ),
    );
  }
}

class ArticleSkeleton extends StatelessWidget {
  const ArticleSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SkeletonScope(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 8, 20, 40),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SkeletonBone(width: 56, height: 10, radius: 6),
            SizedBox(height: 16),
            SkeletonBone(height: 28, radius: 8),
            SizedBox(height: 10),
            SkeletonBone(width: 220, height: 28, radius: 8),
            SizedBox(height: 20),
            SkeletonBone(height: 180, radius: 24),
            SizedBox(height: 20),
            SkeletonBone(height: 14, radius: 8),
            SizedBox(height: 10),
            SkeletonBone(height: 14, radius: 8),
            SizedBox(height: 10),
            SkeletonBone(width: 200, height: 14, radius: 8),
            SizedBox(height: 10),
            SkeletonBone(width: 160, height: 14, radius: 8),
          ],
        ),
      ),
    );
  }
}

class WalletSkeleton extends StatelessWidget {
  const WalletSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SkeletonScope(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonHero(height: 200),
          SizedBox(height: 28),
          SkeletonBone(width: 72, height: 10, radius: 99),
          SizedBox(height: 12),
          SkeletonBone(height: 140, radius: 24),
          SizedBox(height: 28),
          SkeletonBone(width: 64, height: 10, radius: 99),
          SizedBox(height: 12),
          SkeletonBone(height: 56, radius: 16),
          SizedBox(height: 8),
          SkeletonBone(height: 56, radius: 16),
          SizedBox(height: 8),
          SkeletonBone(height: 56, radius: 16),
          SizedBox(height: 8),
          SkeletonBone(height: 56, radius: 16),
        ],
      ),
    );
  }
}

class LeaderboardSkeleton extends StatelessWidget {
  const LeaderboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SkeletonChrome(),
          const SizedBox(height: 16),
          const SkeletonHero(height: 180),
          const SizedBox(height: 24),
          const SkeletonBone(width: 120, height: 18, radius: 8),
          const SizedBox(height: 14),
          Row(
            children: [
              for (var i = 0; i < 4; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                Container(
                  width: 96,
                  height: 140,
                  decoration: BoxDecoration(
                    color: AppColors.bgElevated,
                    borderRadius: BorderRadius.circular(AppRadii.xl),
                    boxShadow: AppShadows.card,
                  ),
                  padding: const EdgeInsets.all(12),
                  child: const Column(
                    children: [
                      SkeletonBone(width: 56, height: 56, radius: 99),
                      SizedBox(height: 12),
                      SkeletonBone(width: 40, height: 8, radius: 99),
                      SizedBox(height: 8),
                      SkeletonBone(width: 64, height: 10, radius: 8),
                    ],
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 24),
          const SkeletonList(count: 5),
        ],
      ),
    );
  }
}

class SupportSkeleton extends StatelessWidget {
  const SupportSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SkeletonScope(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 12, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SkeletonBone(width: 48, height: 10, radius: 99),
            SizedBox(height: 10),
            SkeletonBone(width: 140, height: 28, radius: 8),
            SizedBox(height: 20),
            SkeletonBone(height: 200, radius: 24),
            SizedBox(height: 28),
            SkeletonBone(width: 80, height: 10, radius: 99),
            SizedBox(height: 12),
            SkeletonRow(),
            SizedBox(height: 12),
            SkeletonRow(),
          ],
        ),
      ),
    );
  }
}

class ProfileSkeleton extends StatelessWidget {
  const ProfileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
      children: [
        SkeletonScope(
          child: Column(
            children: [
              const SkeletonChrome(),
              const SizedBox(height: 24),
              const SkeletonHero(height: 220),
              const SizedBox(height: 24),
              Container(
                height: 120,
                decoration: BoxDecoration(
                  color: AppColors.bgElevated,
                  borderRadius: BorderRadius.circular(AppRadii.lg),
                ),
              ),
              const SizedBox(height: 16),
              Container(
                height: 160,
                decoration: BoxDecoration(
                  color: AppColors.bgElevated,
                  borderRadius: BorderRadius.circular(AppRadii.lg),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class CurriculumSkeleton extends StatelessWidget {
  const CurriculumSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Column(
        children: [
          const SkeletonBone(width: 80, height: 80, radius: 99),
          const SizedBox(height: 20),
          const SkeletonBone(width: 240, height: 22, radius: 8),
          const SizedBox(height: 10),
          const SkeletonBone(width: 200, height: 12, radius: 8),
          const SizedBox(height: 28),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F3FB),
              borderRadius: BorderRadius.circular(28),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBone(width: 72, height: 12, radius: 8),
                SizedBox(height: 10),
                SkeletonBone(height: 52, radius: 16),
                SizedBox(height: 16),
                SkeletonBone(width: 72, height: 12, radius: 8),
                SizedBox(height: 10),
                SkeletonBone(height: 52, radius: 16),
                SizedBox(height: 22),
                SkeletonBone(width: 120, height: 10, radius: 99),
                SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: SkeletonBone(height: 48, radius: 16)),
                    SizedBox(width: 10),
                    Expanded(child: SkeletonBone(height: 48, radius: 16)),
                  ],
                ),
                SizedBox(height: 22),
                SkeletonBone(width: 100, height: 10, radius: 99),
                SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: SkeletonBone(height: 48, radius: 16)),
                    SizedBox(width: 10),
                    Expanded(child: SkeletonBone(height: 48, radius: 16)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const SkeletonBone(height: 52, radius: 16),
        ],
      ),
    );
  }
}

class UnlockSheetSkeleton extends StatelessWidget {
  const UnlockSheetSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SkeletonScope(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SkeletonBone(width: 200, height: 22, radius: 8),
            SizedBox(height: 8),
            SkeletonBone(width: 120, height: 14, radius: 8),
            SizedBox(height: 12),
            Row(
              children: [
                SkeletonBone(width: 110, height: 28, radius: 99),
                SizedBox(width: 8),
                SkeletonBone(width: 48, height: 28, radius: 99),
              ],
            ),
            SizedBox(height: 12),
            SkeletonBone(width: 160, height: 14, radius: 8),
          ],
        ),
      ),
    );
  }
}

class StreakSheetSkeleton extends StatelessWidget {
  const StreakSheetSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Row(
          children: [
            for (var i = 0; i < 7; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              const Expanded(child: SkeletonBone(height: 36, radius: 12)),
            ],
          ],
        ),
      ),
    );
  }
}
