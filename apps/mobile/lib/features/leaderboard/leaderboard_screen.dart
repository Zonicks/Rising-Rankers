import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  Map<String, dynamic>? _board;
  Map<String, dynamic>? _achs;
  String _tab = 'global';
  bool _viewAll = false;
  String? _error;
  bool _loading = true;
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
      final board = await widget.api.request('GET', '/api/v1/leaderboard?scope=GLOBAL', auth: true);
      final achs = await widget.api.request('GET', '/api/v1/me/achievements', auth: true);
      final me = await widget.api.request('GET', '/api/v1/me', auth: true);
      if (!mounted) return;
      setState(() {
        _board = board['data'] as Map<String, dynamic>;
        _achs = achs['data'] as Map<String, dynamic>;
        _streak = asInt((me['data'] as Map<String, dynamic>?)?['streakCount']);
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> _list(dynamic raw) =>
      (raw as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final youRank = _board?['youRank'];
    final topPercent = _board?['topPercent'];
    final programName = _board?['programName']?.toString();
    final cityMissing = _board?['cityMissing'] == true;
    final podium = _list(_board?['podium']);
    Map<String, dynamic>? byRank(int n) {
      for (final r in podium) {
        if (asInt(r['rank']) == n) return r;
      }
      return null;
    }

    final list = _list(_board?['list']).where((r) => asInt(r['rank']) > 3).toList();
    final you = _board?['you'] as Map<String, dynamic>?;
    final youOffList = you != null && asInt(you['rank']) > 50 ? you : null;
    final earned = _list(_achs?['earned']);
    final locked = _list(_achs?['locked']);
    final preview = (earned.isNotEmpty ? earned : locked).take(4).toList();

    return SafeArea(
      child: FadeRise(
        child: _loading
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
            : Stack(
                children: [
                  RefreshIndicator(
                    onRefresh: _load,
                    color: AppColors.accent,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                      children: [
                        if (Navigator.of(context).canPop())
                          Align(
                            alignment: Alignment.centerLeft,
                            child: IconButton(
                              onPressed: () => Navigator.of(context).pop(),
                              icon: const Icon(Icons.close_rounded),
                            ),
                          ),
                        StudentChrome(streakCount: _streak, api: widget.api),
                        const SizedBox(height: 16),
                        if (_error != null) InlineError(_error!),
                        if (cityMissing)
                          MeritCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Add your city to appear on the board', style: t.titleMedium),
                                const SizedBox(height: 6),
                                Text(
                                  'Ranks show initials and city only — never full names or photos.',
                                  style: t.bodySmall,
                                ),
                              ],
                            ),
                          ),
                        if (cityMissing) const SizedBox(height: 16),
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
                              Text(
                                'CURRENT STANDING',
                                style: t.labelMedium?.copyWith(color: Colors.white70, letterSpacing: 1.6),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    youRank == null ? '—' : '#$youRank',
                                    style: t.displayLarge?.copyWith(color: Colors.white, fontSize: 52),
                                  ),
                                  const SizedBox(width: 10),
                                  Padding(
                                    padding: const EdgeInsets.only(bottom: 8),
                                    child: Text(
                                      programName == null ? 'Global rank' : '$programName rank',
                                      style: t.titleMedium?.copyWith(color: Colors.white70),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(
                                topPercent == null
                                    ? 'Earn points from practice, quizzes, and streaks to climb the board.'
                                    : 'You\'re in the top $topPercent% of aspirants. Keep the momentum.',
                                style: t.bodyMedium?.copyWith(color: Colors.white70),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 28),
                        Row(
                          children: [
                            Expanded(child: Text('Achievements', style: t.headlineSmall)),
                            TextButton(
                              onPressed: () => setState(() => _viewAll = true),
                              child: const Text('View All'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          height: 176,
                          child: preview.isEmpty
                              ? Text('Achievements unlock as you study.', style: t.bodyMedium)
                              : ListView.separated(
                                  scrollDirection: Axis.horizontal,
                                  itemCount: preview.length,
                                  separatorBuilder: (_, index) => const SizedBox(width: 12),
                                  itemBuilder: (context, i) {
                                    final a = preview[i];
                                    final progress = a['progress'];
                                    final threshold = a['threshold'];
                                    return Container(
                                      width: 128,
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF2F4F6),
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          CircleAvatar(
                                            radius: 28,
                                            backgroundColor: achievementTint(a['tier']?.toString()),
                                            child: Icon(
                                              achievementIcon(a['iconKey']?.toString()),
                                              color: AppColors.deep,
                                            ),
                                          ),
                                          const SizedBox(height: 12),
                                          Text(
                                            progress != null && threshold != null
                                                ? '${asInt(progress)}/${asInt(threshold)}'
                                                : '${a['tier'] ?? ''}',
                                            style: t.bodySmall?.copyWith(
                                              color: AppColors.inkSoft,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            '${a['name']}',
                                            textAlign: TextAlign.center,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: t.labelLarge,
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                        ),
                        const SizedBox(height: 20),
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF2F4F6),
                            borderRadius: BorderRadius.circular(36),
                          ),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text('Leaderboard', style: t.headlineMedium),
                                  ),
                                  DecoratedBox(
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE0E3E5),
                                      borderRadius: BorderRadius.circular(99),
                                    ),
                                    child: Row(
                                      children: [
                                        _TabChip(
                                          label: 'Global',
                                          selected: _tab == 'global',
                                          onTap: () => setState(() => _tab = 'global'),
                                        ),
                                        _TabChip(
                                          label: 'Friends',
                                          selected: _tab == 'friends',
                                          onTap: () => setState(() => _tab = 'friends'),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 24),
                              if (_tab == 'friends')
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 32),
                                  child: Text(
                                    'Friends ranks arrive when follows ship. For now, climb the program board.',
                                    textAlign: TextAlign.center,
                                    style: t.bodyMedium,
                                  ),
                                )
                              else ...[
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Expanded(child: _Podium(row: byRank(2), place: 2)),
                                    Expanded(child: _Podium(row: byRank(1), place: 1)),
                                    Expanded(child: _Podium(row: byRank(3), place: 3)),
                                  ],
                                ),
                                const SizedBox(height: 20),
                                ...list.map((row) => Padding(
                                      padding: const EdgeInsets.only(bottom: 10),
                                      child: _RankRow(row: row),
                                    )),
                                if (youOffList != null)
                                  Padding(
                                    padding: const EdgeInsets.only(bottom: 10),
                                    child: _RankRow(row: youOffList),
                                  ),
                                if (list.isEmpty && byRank(1) == null)
                                  Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 24),
                                    child: Text('No ranked students yet.', style: t.bodyMedium),
                                  ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_viewAll)
                    Positioned.fill(
                      child: Material(
                        color: Colors.black.withValues(alpha: 0.4),
                        child: Align(
                          alignment: Alignment.bottomCenter,
                          child: Container(
                            constraints: BoxConstraints(
                              maxHeight: MediaQuery.sizeOf(context).height * 0.82,
                            ),
                            decoration: const BoxDecoration(
                              color: AppColors.bgElevated,
                              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                            ),
                            child: ListView(
                              padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
                              children: [
                                Row(
                                  children: [
                                    Expanded(child: Text('Achievements', style: t.headlineMedium)),
                                    TextButton(
                                      onPressed: () => setState(() => _viewAll = false),
                                      child: const Text('Close'),
                                    ),
                                  ],
                                ),
                                if (earned.isNotEmpty) ...[
                                  const SizedBox(height: 12),
                                  Text('EARNED', style: t.labelMedium),
                                  const SizedBox(height: 8),
                                  ...earned.map((a) => _AchTile(row: a, locked: false)),
                                ],
                                if (locked.isNotEmpty) ...[
                                  const SizedBox(height: 16),
                                  Text('LOCKED', style: t.labelMedium),
                                  const SizedBox(height: 8),
                                  ...locked.map((a) => _AchTile(row: a, locked: true)),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  const _TabChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(99),
          boxShadow: selected
              ? [BoxShadow(color: AppColors.ink.withValues(alpha: 0.06), blurRadius: 8)]
              : null,
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: selected ? AppColors.ink : AppColors.inkSoft,
                fontWeight: FontWeight.w800,
                fontSize: 12,
              ),
        ),
      ),
    );
  }
}

class _Podium extends StatelessWidget {
  const _Podium({this.row, required this.place});

  final Map<String, dynamic>? row;
  final int place;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final size = place == 1 ? 80.0 : 56.0;
    final initials = row?['initials']?.toString() ?? '—';
    final you = row?['isYou'] == true;
    return Padding(
      padding: EdgeInsets.only(top: place == 1 ? 0 : 28),
      child: Column(
        children: [
          if (place == 1) const Text('👑', style: TextStyle(fontSize: 18)),
          CircleAvatar(
            radius: size / 2,
            backgroundColor: achievementTint(place == 1 ? 'GOLD' : place == 2 ? 'SILVER' : 'BRONZE'),
            child: Text(
              initials,
              style: t.titleMedium?.copyWith(
                color: AppColors.deep,
                fontWeight: FontWeight.w800,
                fontSize: place == 1 ? 16 : 11,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            you ? 'You' : initials,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: t.labelLarge,
          ),
          Text(
            row == null ? '' : '${asInt(row!['points'])} pts',
            style: t.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _RankRow extends StatelessWidget {
  const _RankRow({required this.row});

  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final you = row['isYou'] == true;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: you ? Border.all(color: AppColors.accent.withValues(alpha: 0.35), width: 2) : null,
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            SizedBox(
              width: 24,
              child: Text(
                '${asInt(row['rank'])}',
                textAlign: TextAlign.center,
                style: t.titleMedium?.copyWith(color: you ? AppColors.accent : AppColors.inkSoft),
              ),
            ),
            const SizedBox(width: 10),
            CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.accentSoft,
              child: Text(
                '${row['initials']}',
                style: t.labelLarge?.copyWith(color: AppColors.accent, fontSize: 11),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(you ? '${row['initials']} (You)' : '${row['initials']}', style: t.titleMedium),
                  Text('${row['city']} · ${row['programName']}', style: t.bodySmall),
                ],
              ),
            ),
            Text(
              '${asInt(row['points'])}',
              style: t.titleMedium?.copyWith(color: AppColors.accent),
            ),
          ],
        ),
      ),
    );
  }
}

class _AchTile extends StatelessWidget {
  const _AchTile({required this.row, required this.locked});

  final Map<String, dynamic> row;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Opacity(
        opacity: locked ? 0.7 : 1,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: const Color(0xFFF2F4F6),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: locked ? const Color(0xFFC6C5D4) : achievementTint(row['tier']?.toString()),
                  child: Icon(achievementIcon(row['iconKey']?.toString()), color: AppColors.deep),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${row['name']}', style: t.titleMedium),
                      Text(
                        locked
                            ? '${asInt(row['progress'])}/${asInt(row['threshold'])} · ${row['description']}'
                            : '${row['description']}',
                        style: t.bodySmall,
                      ),
                    ],
                  ),
                ),
                if (!locked)
                  Text('+${asInt(row['pointsReward'])}', style: t.labelLarge?.copyWith(color: AppColors.accent)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

void openLeaderboard(BuildContext context, ApiClient api) {
  Navigator.of(context).push(
    PageRouteBuilder(
      pageBuilder: (context, animation, secondaryAnimation) => Scaffold(
        body: AppAtmosphere(child: LeaderboardScreen(api: api)),
      ),
      transitionsBuilder: (context, animation, secondaryAnimation, child) =>
          FadeTransition(opacity: animation, child: child),
      transitionDuration: const Duration(milliseconds: 200),
    ),
  );
}
