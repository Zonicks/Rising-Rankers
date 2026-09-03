import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/theme.dart';

/// Soft atmosphere wash behind screens (not a flat slab).
class AppAtmosphere extends StatelessWidget {
  const AppAtmosphere({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
        decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFE7EEFB),
            AppColors.bg,
            Color(0xFFFBF6DC),
          ],
          stops: [0.0, 0.5, 1.0],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -80,
            right: -60,
            child: IgnorePointer(
              child: Container(
                width: 320,
                height: 320,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.accent.withValues(alpha: 0.16),
                      AppColors.accent.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 80,
            left: -80,
            child: IgnorePointer(
              child: Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF3C4450).withValues(alpha: 0.04),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

/// Fade + slight rise on first paint (Design.md page enter).
class FadeRise extends StatefulWidget {
  const FadeRise({super.key, required this.child, this.delay = Duration.zero});

  final Widget child;
  final Duration delay;

  @override
  State<FadeRise> createState() => _FadeRiseState();
}

class _FadeRiseState extends State<FadeRise> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 220),
  );
  late final Animation<double> _opacity = CurvedAnimation(parent: _c, curve: Curves.easeOut);
  late final Animation<Offset> _offset = Tween<Offset>(
    begin: const Offset(0, 0.02),
    end: Offset.zero,
  ).animate(CurvedAnimation(parent: _c, curve: Curves.easeOut));

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(widget.delay, () {
      if (mounted) _c.forward();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _offset, child: widget.child),
    );
  }
}

class ScreenHeader extends StatelessWidget {
  const ScreenHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.overline,
  });

  final String title;
  final String? subtitle;
  final String? overline;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (overline != null) ...[
                Text(overline!.toUpperCase(), style: t.labelMedium),
                const SizedBox(height: 8),
              ],
              Text(title, style: t.headlineLarge),
              if (subtitle != null) ...[
                const SizedBox(height: 8),
                Text(subtitle!, style: t.bodyMedium),
              ],
            ],
          ),
        ),
        ?trailing,
      ],
    );
  }
}

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: onPressed == null || busy
              ? null
              : const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.accent, AppColors.deep],
                ),
          color: onPressed == null || busy ? AppColors.bgHigh : null,
          boxShadow: onPressed == null || busy ? null : AppShadows.lift,
        ),
        child: FilledButton(
          onPressed: busy ? null : onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: Colors.transparent,
            disabledBackgroundColor: Colors.transparent,
            shadowColor: Colors.transparent,
          ),
          child: busy
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text(label),
        ),
      ),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: OutlinedButton(onPressed: onPressed, child: Text(label)),
    );
  }
}

class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text, style: Theme.of(context).textTheme.titleMedium),
    );
  }
}

class InlineError extends StatelessWidget {
  const InlineError(this.message, {super.key});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.dangerSoft,
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Text(
        message,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.danger),
      ),
    );
  }
}

class MoneyText extends StatelessWidget {
  const MoneyText(this.value, {super.key, this.style, this.large = false});

  final dynamic value;
  final TextStyle? style;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final raw = value?.toString() ?? '—';
    final display = raw == '—' ? '—' : (raw.startsWith('₹') ? raw : '₹$raw');
    return Text(
      display,
      style: (style ??
              (large
                  ? Theme.of(context).textTheme.displayMedium
                  : Theme.of(context).textTheme.titleLarge))
          ?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
    );
  }
}

class MetricRow extends StatelessWidget {
  const MetricRow({super.key, required this.items});

  final List<(String label, dynamic value)> items;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0)
            Container(width: 1, height: 36, color: AppColors.line, margin: const EdgeInsets.symmetric(horizontal: 16)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(items[i].$1, style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 4),
                MoneyText(items[i].$2),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class HairlineListTile extends StatelessWidget {
  const HairlineListTile({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.showDivider = true,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadii.sm),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: Theme.of(context).textTheme.titleMedium),
                      if (subtitle != null) ...[
                        const SizedBox(height: 4),
                        Text(subtitle!, style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ],
                  ),
                ),
                ?trailing,
              ],
            ),
          ),
        ),
        if (showDivider) const Divider(height: 1),
      ],
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key, this.tone = StatusTone.neutral});

  final String label;
  final StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      StatusTone.accent => (AppColors.accentSoft, AppColors.accent),
      StatusTone.success => (AppColors.successSoft, AppColors.success),
      StatusTone.danger => (AppColors.dangerSoft, AppColors.danger),
      StatusTone.neutral => (AppColors.bg, AppColors.inkSoft),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadii.sm),
        border: Border.all(color: AppColors.line.withValues(alpha: 0.8)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: fg, fontWeight: FontWeight.w600),
      ),
    );
  }
}

enum StatusTone { neutral, accent, success, danger }

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    required this.body,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String body;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.accentSoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.auto_awesome_rounded, color: AppColors.accent),
          ),
          const SizedBox(height: 20),
          Text(title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(body, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 20),
            PrimaryButton(label: actionLabel!, onPressed: onAction),
          ],
        ],
      ),
    );
  }
}

class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 56, this.light = false});

  final double size;
  final bool light;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Image.asset(
        'assets/brand/logo.png',
        fit: BoxFit.contain,
        width: size,
        height: size,
        filterQuality: FilterQuality.high,
      ),
    );
  }
}

class IconBurst extends StatelessWidget {
  const IconBurst({super.key, required this.icon, this.color = AppColors.accent});

  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      height: 220,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 220,
            height: 220,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withValues(alpha: 0.08),
            ),
          ),
          Container(
            width: 150,
            height: 150,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withValues(alpha: 0.14),
            ),
          ),
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [color, color.withValues(alpha: 0.75)],
              ),
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.35),
                  blurRadius: 28,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 42),
          ),
        ],
      ),
    );
  }
}

class MeritCard extends StatelessWidget {
  const MeritCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.onTap,
    this.color = AppColors.bgElevated,
  });

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: AppColors.line.withValues(alpha: 0.15)),
        boxShadow: AppShadows.card,
      ),
      child: child,
    );
    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        child: card,
      ),
    );
  }
}

class FeatureTile extends StatelessWidget {
  const FeatureTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.tint = AppColors.accentSoft,
    this.iconColor = AppColors.accent,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Color tint;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return MeritCard(
      onTap: onTap,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(height: 16),
          Text(title, style: t.titleMedium),
          const SizedBox(height: 4),
          Text(subtitle, style: t.bodySmall),
        ],
      ),
    );
  }
}

class WalletHero extends StatelessWidget {
  const WalletHero({
    super.key,
    required this.award,
    this.deposited,
    this.promo,
    this.onTap,
  });

  final dynamic award;
  final dynamic deposited;
  final dynamic promo;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(22, 22, 22, 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadii.xl),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF050B18), Color(0xFF0C1B3D), Color(0xFF1E4FC4)],
          ),
          boxShadow: AppShadows.lift,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'AWARD BALANCE',
                  style: t.labelMedium?.copyWith(color: Colors.white70, letterSpacing: 1),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.workspace_premium_rounded, size: 14, color: AppColors.gold),
                      const SizedBox(width: 4),
                      Text('Scholarship', style: t.bodySmall?.copyWith(color: Colors.white)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            MoneyText(
              award,
              style: t.displayMedium?.copyWith(color: Colors.white, letterSpacing: -0.6),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                _mini('Deposited', deposited),
                const SizedBox(width: 20),
                _mini('Promo', promo),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _mini(String label, dynamic value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 12, fontWeight: FontWeight.w500)),
          const SizedBox(height: 4),
          MoneyText(value, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class StudentChrome extends StatelessWidget {
  const StudentChrome({super.key, required this.streakCount, this.onStreak, this.api, this.onSearch});

  final int streakCount;
  final VoidCallback? onStreak;
  final ApiClient? api;
  final VoidCallback? onSearch;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Row(
      children: [
        const BrandMark(size: 40),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            AppTheme.brandName,
            style: t.titleLarge?.copyWith(color: AppColors.accent, fontWeight: FontWeight.w800),
          ),
        ),
        if (onSearch != null)
          IconButton(
            tooltip: 'Search',
            onPressed: onSearch,
            icon: const Icon(Icons.search_rounded, color: AppColors.inkSoft),
          ),
        StreakPill(count: streakCount, onTap: onStreak, api: api),
      ],
    );
  }
}

class StreakPill extends StatelessWidget {
  const StreakPill({super.key, required this.count, this.onTap, this.api});

  final int count;
  final VoidCallback? onTap;
  final ApiClient? api;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFECEEF0),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap ?? () => showStreakSheet(context, count, api: api),
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          child: Text(
            '🔥 $count',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppColors.accent,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ),
      ),
    );
  }
}

void showStreakSheet(BuildContext context, int count, {ApiClient? api}) {
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.bgElevated,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => _StreakSheetBody(count: count, api: api),
  );
}

class _StreakSheetBody extends StatefulWidget {
  const _StreakSheetBody({required this.count, this.api});

  final int count;
  final ApiClient? api;

  @override
  State<_StreakSheetBody> createState() => _StreakSheetBodyState();
}

class _StreakSheetBodyState extends State<_StreakSheetBody> {
  int _count = 0;
  String _hint = 'Do 10 MCQs or 5 cards today to keep it.';
  List<Map<String, dynamic>> _days = [];

  @override
  void initState() {
    super.initState();
    _count = widget.count;
    _load();
  }

  Future<void> _load() async {
    final api = widget.api;
    if (api == null) return;
    try {
      final res = await api.request('GET', '/api/v1/me/streak', auth: true);
      final data = res['data'] as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _count = asInt(data['streakCount'], widget.count);
        _hint = data['hint']?.toString() ?? _hint;
        _days = (data['days'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
      });
    } catch (_) {}
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
          Text('Streak', style: t.labelMedium),
          const SizedBox(height: 8),
          Text('🔥 $_count day${_count == 1 ? '' : 's'}', style: t.headlineMedium),
          const SizedBox(height: 12),
          Text(_hint, style: t.bodyMedium),
          if (_days.isNotEmpty) ...[
            const SizedBox(height: 16),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _days.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 7,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
              ),
              itemBuilder: (context, i) {
                final d = _days[i];
                final date = d['date']?.toString() ?? '';
                final qualified = d['qualified'] == true;
                final day = date.length >= 10 ? date.substring(8, 10) : '${i + 1}';
                return DecoratedBox(
                  decoration: BoxDecoration(
                    color: qualified ? AppColors.gold : const Color(0xFFECEEF0),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      day.startsWith('0') ? day.substring(1) : day,
                      style: t.labelLarge?.copyWith(
                        color: qualified ? AppColors.deep : AppColors.muted,
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
          const SizedBox(height: 12),
          Text(
            'A day counts when you rate 5 flashcards, answer 10 MCQs, submit a quiz or test, or finish a news article.',
            style: t.bodySmall,
          ),
          const SizedBox(height: 20),
          PrimaryButton(label: 'Got it', onPressed: () => Navigator.pop(context)),
        ],
      ),
    );
  }
}

void showRewardsToast(BuildContext context, Map<String, dynamic>? rewards) {
  if (rewards == null || !context.mounted) return;
  final unlocked = (rewards['unlocked'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
  final delta = asInt(rewards['pointsDelta']);
  String? msg;
  if (unlocked.isNotEmpty) {
    final name = unlocked.first['name']?.toString() ?? 'Achievement';
    final pts = asInt(unlocked.first['pointsReward']);
    msg = pts > 0 ? 'Unlocked $name · +$pts pts' : 'Unlocked $name';
  } else if (delta > 0) {
    msg = '+$delta pts';
  }
  if (msg == null) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(msg),
      backgroundColor: AppColors.deep,
      behavior: SnackBarBehavior.floating,
      duration: const Duration(milliseconds: 2600),
    ),
  );
}

IconData achievementIcon(String? key) {
  switch (key) {
    case 'local_fire_department':
      return Icons.local_fire_department_rounded;
    case 'style':
      return Icons.style_rounded;
    case 'quiz':
      return Icons.quiz_rounded;
    case 'gavel':
      return Icons.gavel_rounded;
    case 'history_edu':
      return Icons.history_edu_rounded;
    default:
      return Icons.emoji_events_rounded;
  }
}

Color achievementTint(String? tier) {
  switch (tier) {
    case 'GOLD':
      return AppColors.gold;
    case 'SILVER':
      return const Color(0xFFC0C0C0);
    case 'BRONZE':
      return const Color(0xFFCD7F32);
    default:
      return AppColors.accentSoft;
  }
}

int asInt(dynamic value, [int fallback = 0]) {
  if (value is num) return value.toInt();
  return int.tryParse('$value') ?? fallback;
}

String initialsOf(String name) {
  final parts = name.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).take(2);
  return parts.map((p) => p[0].toUpperCase()).join();
}
