import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/skeleton.dart';
import '../../ui/widgets.dart';
import '../leaderboard/leaderboard_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.api,
    required this.onOpenMcq,
    required this.onOpenCards,
    required this.onOpenNews,
    required this.onOpenStudy,
    this.onSearch,
  });

  final ApiClient api;
  final VoidCallback onOpenMcq;
  final VoidCallback onOpenCards;
  final VoidCallback onOpenNews;
  final void Function(String subjectId) onOpenStudy;
  final VoidCallback? onSearch;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _data;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await widget.api.request(
        'GET',
        '/api/v1/me/progress',
        auth: true,
      );
      setState(() {
        _data = res['data'] as Map<String, dynamic>;
        _error = null;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final completion = _data?['completion'] as Map<String, dynamic>? ?? {};
    final daily = _data?['daily'] as Map<String, dynamic>? ?? {};
    final program = _data?['program'] as Map<String, dynamic>?;
    final subjects = (_data?['subjects'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final pct = asInt(completion['pct']);
    final streak = asInt(_data?['streakCount']);
    final firstLoad = _data == null && _error == null;

    return SafeArea(
      bottom: false,
      child: FadeRise(
        child: RefreshIndicator(
          onRefresh: _load,
          color: AppColors.accent,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
            children: [
              if (firstLoad) ...[
                const HomeSkeleton(),
              ] else ...[
                StudentChrome(
                  streakCount: streak,
                  api: widget.api,
                  onSearch: widget.onSearch,
                ),
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(28),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppRadii.hero),
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppColors.deep,
                        AppColors.deepMid,
                        AppColors.accent,
                      ],
                    ),
                    boxShadow: AppShadows.lift,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SYLLABUS COVERAGE',
                        style: t.labelMedium?.copyWith(
                          color: Colors.white70,
                          letterSpacing: 1.6,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Syllabus Completion',
                        style: t.headlineMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '$pct%',
                            style: t.displayMedium?.copyWith(
                              color: Colors.white,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '${asInt(completion['touchedModules'])} of ${asInt(completion['totalModules'])} Modules',
                            style: t.bodySmall?.copyWith(color: Colors.white70),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: LinearProgressIndicator(
                          value: pct / 100,
                          minHeight: 12,
                          backgroundColor: Colors.white24,
                          color: const Color(0xFF4EDEA3),
                        ),
                      ),
                      if (program?['name'] != null) ...[
                        const SizedBox(height: 14),
                        Text(
                          '${program!['name']}',
                          style: t.bodySmall?.copyWith(color: Colors.white60),
                        ),
                      ],
                    ],
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  InlineError(_error!),
                ],
                const SizedBox(height: 32),
                Text(
                  'Daily Focus',
                  style: t.headlineSmall?.copyWith(color: AppColors.accent),
                ),
                const SizedBox(height: 14),
                GestureDetector(
                  onTap: widget.onOpenMcq,
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF2F4F6),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            color: AppColors.accentSoft,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Icon(
                            Icons.quiz_rounded,
                            color: AppColors.accent,
                            size: 28,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Daily Quiz', style: t.titleLarge),
                              Text(
                                '${asInt(daily['quizQuestions'], 20)} Questions · ${asInt(daily['quizMinutes'], 15)} Mins',
                                style: t.bodySmall,
                              ),
                            ],
                          ),
                        ),
                        const Icon(
                          Icons.chevron_right_rounded,
                          color: AppColors.muted,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _FocusSquare(
                        icon: Icons.style_rounded,
                        iconBg: const Color(0xFF4EDEA3).withValues(alpha: 0.2),
                        iconColor: AppColors.success,
                        title: 'Flashcard Session',
                        subtitle:
                            '${asInt(daily['flashRemaining'])} left today',
                        onTap: widget.onOpenCards,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _FocusSquare(
                        icon: Icons.article_rounded,
                        iconBg: AppColors.accentSoft,
                        iconColor: AppColors.accent,
                        title: 'Current Affairs',
                        subtitle: '${asInt(daily['unreadArticles'])} unread',
                        onTap: widget.onOpenNews,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 32),
                MeritCard(
                  onTap: () => openLeaderboard(context, widget.api),
                  child: Row(
                    children: [
                      const CircleAvatar(
                        backgroundColor: AppColors.accentSoft,
                        child: Icon(
                          Icons.emoji_events_rounded,
                          color: AppColors.accent,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Leaderboard', style: t.titleLarge),
                            Text(
                              'Initials, city, and points — same program.',
                              style: t.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: AppColors.muted,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                Text(
                  'Subject Mastery',
                  style: t.headlineSmall?.copyWith(color: AppColors.accent),
                ),
                const SizedBox(height: 14),
                if (subjects.isEmpty)
                  Text(
                    'No subjects in your curriculum yet.',
                    style: t.bodyMedium,
                  )
                else
                  ...subjects.map((s) {
                    final reliable = s['reliable'] == true;
                    final mastery = s['masteryPct'];
                    final label = mastery == null ? '—' : '${asInt(mastery)}%';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: MeritCard(
                        onTap: () => widget.onOpenStudy('${s['id']}'),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 16,
                                  backgroundColor: AppColors.accentSoft,
                                  child: Text(
                                    initialsOf('${s['name']}'),
                                    style: t.labelLarge?.copyWith(
                                      color: AppColors.accent,
                                      fontSize: 11,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    '${s['name']}',
                                    style: t.titleMedium,
                                  ),
                                ),
                                Text(
                                  label,
                                  style: t.titleMedium?.copyWith(
                                    color: reliable
                                        ? AppColors.accent
                                        : AppColors.muted,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(99),
                              child: LinearProgressIndicator(
                                value: asInt(mastery) / 100,
                                minHeight: 6,
                                backgroundColor: const Color(0xFFECEEF0),
                                color: reliable
                                    ? AppColors.accent
                                    : const Color(0xFFC6C5D4),
                              ),
                            ),
                            if (!reliable) ...[
                              const SizedBox(height: 8),
                              Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  'Needs 5 attempts',
                                  style: t.bodySmall,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _FocusSquare extends StatelessWidget {
  const _FocusSquare({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return GestureDetector(
      onTap: onTap,
      child: AspectRatio(
        aspectRatio: 1,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFF2F4F6),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor),
              ),
              const Spacer(),
              Text(title, style: t.titleMedium),
              const SizedBox(height: 4),
              Text(subtitle, style: t.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}
