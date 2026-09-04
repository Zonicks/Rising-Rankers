import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/skeleton.dart';
import '../../ui/widgets.dart';
import '../about/about_screen.dart';
import '../legal/legal_screen.dart';
import '../leaderboard/leaderboard_screen.dart';
import '../support/support_screen.dart';
import '../curriculum/curriculum_screen.dart';
import '../wallet/wallet_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.api,
    required this.onSignOut,
    this.onSearch,
  });

  final ApiClient api;
  final Future<void> Function() onSignOut;
  final VoidCallback? onSearch;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _name = TextEditingController();
  final _mobile = TextEditingController();
  final _classOrExam = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _parent = TextEditingController();
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();

  String? _email;
  String? _programName;
  int? _targetYear;
  DateTime? _dob;
  bool _consent = false;
  String? _consentAt;
  int _streak = 0;
  int _points = 0;
  String? _award;
  List<Map<String, dynamic>> _achievements = [];
  int _achievementTotal = 0;
  bool _achsFailed = false;

  bool _ready = false;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _mobile.dispose();
    _classOrExam.dispose();
    _city.dispose();
    _state.dispose();
    _parent.dispose();
    _currentPassword.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      Map<String, dynamic>? achData;
      var achsFailed = false;
      final meFuture = widget.api.request('GET', '/api/v1/me', auth: true);
      final achFuture = () async {
        try {
          return await widget.api.request(
            'GET',
            '/api/v1/me/achievements',
            auth: true,
          );
        } catch (_) {
          achsFailed = true;
          return null;
        }
      }();
      final res = await meFuture;
      final achRes = await achFuture;
      if (achRes != null && achRes['data'] is Map) {
        achData = achRes['data'] as Map<String, dynamic>;
      }

      final data = res['data'] as Map<String, dynamic>;
      final user = data['user'] as Map<String, dynamic>? ?? {};
      final profile = data['profile'] as Map<String, dynamic>? ?? {};
      final curriculum = data['curriculum'] as Map<String, dynamic>?;
      final wallet = data['wallet'] as Map<String, dynamic>?;
      _email = user['email']?.toString();
      _name.text = user['fullName']?.toString() ?? '';
      _mobile.text = profile['mobile']?.toString() ?? '';
      _classOrExam.text = profile['classOrExam']?.toString() ?? '';
      _city.text = profile['city']?.toString() ?? '';
      _state.text = profile['state']?.toString() ?? '';
      _parent.text = profile['parentGuardian']?.toString() ?? '';
      _dob = _parseDob(profile['dateOfBirth']);
      _consent = profile['consentAccepted'] == true;
      _consentAt = profile['consentAt']?.toString();
      _programName = curriculum?['programName']?.toString();
      final ty = curriculum?['targetYear'];
      _targetYear = ty is num ? ty.toInt() : null;
      _streak = asInt(data['streakCount']);
      _points = asInt(data['pointsBalance']);
      _award = wallet?['award']?.toString();

      final earned = _asMaps(achData?['earned']);
      final locked = _asMaps(achData?['locked']);
      final source = earned.isNotEmpty ? earned : locked;
      _achievementTotal = source.length;
      _achievements = source.take(4).toList();
      _achsFailed = achsFailed;

      if (!mounted) return;
      setState(() {
        _loading = false;
        _ready = true;
        _error = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message;
      });
    }
  }

  List<Map<String, dynamic>> _asMaps(dynamic raw) =>
      (raw as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();

  Future<String?> _saveProfile({DateTime? dob, required bool consent}) async {
    try {
      await widget.api.request(
        'PATCH',
        '/api/v1/me/profile',
        auth: true,
        body: {
          if (_name.text.trim().isNotEmpty) 'fullName': _name.text.trim(),
          'mobile': _mobile.text.trim().isEmpty ? null : _mobile.text.trim(),
          'classOrExam': _classOrExam.text.trim().isEmpty
              ? null
              : _classOrExam.text.trim(),
          'city': _city.text.trim().isEmpty ? null : _city.text.trim(),
          'state': _state.text.trim().isEmpty ? null : _state.text.trim(),
          'parentGuardian': _parent.text.trim().isEmpty
              ? null
              : _parent.text.trim(),
          'dateOfBirth': dob == null ? null : _toYmd(dob),
          if (consent) 'consentAccepted': true,
        },
      );
      await _load(silent: true);
      return null;
    } on ApiException catch (e) {
      return e.message;
    }
  }

  Future<String?> _savePassword() async {
    if (_newPassword.text != _confirmPassword.text) {
      return 'New passwords do not match';
    }
    if (_newPassword.text.length < 8) {
      return 'New password must be at least 8 characters';
    }
    try {
      await widget.api.request(
        'PATCH',
        '/api/v1/me/password',
        auth: true,
        body: {
          'currentPassword': _currentPassword.text,
          'newPassword': _newPassword.text,
        },
      );
      _currentPassword.clear();
      _newPassword.clear();
      _confirmPassword.clear();
      return null;
    } on ApiException catch (e) {
      return e.message;
    }
  }

  DateTime? _parseDob(dynamic raw) {
    if (raw == null) return null;
    final s = raw.toString();
    if (s.length < 10) return null;
    final y = int.tryParse(s.substring(0, 4));
    final m = int.tryParse(s.substring(5, 7));
    final d = int.tryParse(s.substring(8, 10));
    if (y == null || m == null || d == null) return null;
    return DateTime(y, m, d);
  }

  String _toYmd(DateTime d) {
    final y = d.year.toString().padLeft(4, '0');
    final m = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$y-$m-$day';
  }

  String _formatDob(DateTime? d) {
    if (d == null) return '';
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  String _formatConsentAt(String? iso) {
    final d = _parseDob(iso);
    return d == null ? '' : _formatDob(d);
  }

  String _display(String value) => value.trim().isEmpty ? '—' : value.trim();

  String _consentLabel() {
    if (!_consent) return 'Not yet';
    final when = _formatConsentAt(_consentAt);
    return when.isEmpty ? 'Accepted' : 'Accepted · $when';
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _openPage(Widget child, {bool atmosphere = true}) {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            atmosphere ? Scaffold(body: AppAtmosphere(child: child)) : child,
        transitionsBuilder: (context, animation, secondaryAnimation, child) =>
            FadeTransition(opacity: animation, child: child),
        transitionDuration: const Duration(milliseconds: 200),
      ),
    );
  }

  Future<void> _openEdit({bool focusCity = false}) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.bgElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
          child: _EditProfileSheet(
            name: _name,
            mobile: _mobile,
            classOrExam: _classOrExam,
            city: _city,
            state: _state,
            parent: _parent,
            dob: _dob,
            consent: _consent,
            consentAt: _consentAt,
            focusCity: focusCity,
            formatDob: _formatDob,
            formatConsentAt: _formatConsentAt,
            onSave: ({required dob, required consent}) =>
                _saveProfile(dob: dob, consent: consent),
            onCancel: () async {
              Navigator.of(ctx).pop(false);
              await _load(silent: true);
            },
          ),
        );
      },
    );
    if (saved == true) _snack('Profile saved');
  }

  Future<void> _openPassword() async {
    _currentPassword.clear();
    _newPassword.clear();
    _confirmPassword.clear();
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.bgElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
          child: _PasswordSheet(
            currentPassword: _currentPassword,
            newPassword: _newPassword,
            confirmPassword: _confirmPassword,
            onSave: _savePassword,
            onCancel: () {
              _currentPassword.clear();
              _newPassword.clear();
              _confirmPassword.clear();
              Navigator.of(ctx).pop(false);
            },
          ),
        );
      },
    );
    if (saved == true) _snack('Password updated');
  }

  Future<void> _confirmSignOut() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final t = Theme.of(ctx).textTheme;
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          title: const Text('Sign out?'),
          content: Text(
            'You’ll need your email and password to get back in.',
            style: t.bodyMedium,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(
                'Sign out',
                style: t.titleMedium?.copyWith(color: AppColors.danger),
              ),
            ),
          ],
        );
      },
    );
    if (ok == true) await widget.onSignOut();
  }

  void _openWallet() {
    _openPage(WalletScreen(api: widget.api));
  }

  void _openCurriculum() {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            CurriculumScreen(
              api: widget.api,
              rebuild: true,
              onDone: () {
                Navigator.of(context).pop();
                _load(silent: true);
              },
            ),
        transitionsBuilder: (context, animation, secondaryAnimation, child) =>
            FadeTransition(opacity: animation, child: child),
        transitionDuration: const Duration(milliseconds: 200),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: FadeRise(
        child: RefreshIndicator(
          onRefresh: () => _load(),
          color: AppColors.accent,
          child: !_ready && _loading
              ? const ProfileSkeleton()
              : !_ready && _error != null
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
                  children: [
                    StudentChrome(
                      streakCount: _streak,
                      api: widget.api,
                      onSearch: widget.onSearch,
                    ),
                    const SizedBox(height: 24),
                    InlineError(_error!),
                    const SizedBox(height: 12),
                    TextButton(onPressed: _load, child: const Text('Retry')),
                  ],
                )
              : ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
                  children: [
                    StudentChrome(
                      streakCount: _streak,
                      api: widget.api,
                      onSearch: widget.onSearch,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 16),
                      InlineError(_error!),
                    ],
                    const SizedBox(height: 24),
                    _IdentityHero(
                      name: _name.text.trim().isEmpty
                          ? 'Student'
                          : _name.text.trim(),
                      email: _email ?? '—',
                      program: _programName,
                      targetYear: _targetYear,
                      city: _city.text.trim(),
                      streak: _streak,
                      points: _points,
                      award: _award,
                      onEdit: _openEdit,
                      onStreak: () =>
                          showStreakSheet(context, _streak, api: widget.api),
                      onPoints: () => openLeaderboard(context, widget.api),
                      onAward: _openWallet,
                    ),
                    if (_city.text.trim().isEmpty) ...[
                      const SizedBox(height: 16),
                      _CityCallout(onAdd: () => _openEdit(focusCity: true)),
                    ],
                    if (!_achsFailed) ...[
                      const SizedBox(height: 24),
                      _AchievementsStrip(
                        items: _achievements,
                        total: _achievementTotal,
                        onTap: () => openLeaderboard(context, widget.api),
                      ),
                    ],
                    const SizedBox(height: 24),
                    Text(
                      'SHORTCUTS',
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: FeatureTile(
                            icon: Icons.emoji_events_rounded,
                            title: 'Leaderboard',
                            subtitle: 'Initials and city',
                            tint: AppColors.goldSoft,
                            iconColor: AppColors.deep,
                            onTap: () => openLeaderboard(context, widget.api),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FeatureTile(
                            icon: Icons.account_balance_wallet_rounded,
                            title: 'Wallet',
                            subtitle: 'Awards and deposits',
                            onTap: _openWallet,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: FeatureTile(
                            icon: Icons.support_agent_rounded,
                            title: 'Help & support',
                            subtitle: 'Tickets and account',
                            onTap: () => _openPage(
                              SupportScreen(api: widget.api),
                              atmosphere: false,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FeatureTile(
                            icon: Icons.info_outline_rounded,
                            title: 'About',
                            subtitle: 'App and version',
                            tint: AppColors.bgLow,
                            iconColor: AppColors.inkSoft,
                            onTap: () => _openPage(
                              AboutScreen(api: widget.api),
                              atmosphere: false,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    _AboutYouCard(
                      mobile: _display(_mobile.text),
                      classOrExam: _display(_classOrExam.text),
                      city: _display(_city.text),
                      state: _display(_state.text),
                      dob: _display(_formatDob(_dob)),
                      parent: _display(_parent.text),
                      consent: _consentLabel(),
                      consented: _consent,
                      onEdit: _openEdit,
                    ),
                    const SizedBox(height: 28),
                    Text(
                      'ACCOUNT',
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                    const SizedBox(height: 12),
                    MeritCard(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      child: Column(
                        children: [
                          _AccountRow(
                            icon: Icons.lock_outline_rounded,
                            title: 'Change password',
                            onTap: _openPassword,
                          ),
                          _AccountRow(
                            icon: Icons.auto_stories_outlined,
                            title: 'Rebuild curriculum',
                            subtitle:
                                'Change program or target year. Your question bank stays.',
                            onTap: _openCurriculum,
                          ),
                          _AccountRow(
                            icon: Icons.gavel_rounded,
                            title: 'Legal, FAQ & policies',
                            onTap: () => _openPage(
                              const LegalScreen(),
                              atmosphere: false,
                            ),
                            showDivider: false,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 28),
                    Center(
                      child: TextButton(
                        onPressed: _confirmSignOut,
                        child: Text(
                          'Sign out',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(color: AppColors.danger),
                        ),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

class _IdentityHero extends StatelessWidget {
  const _IdentityHero({
    required this.name,
    required this.email,
    required this.program,
    required this.targetYear,
    required this.city,
    required this.streak,
    required this.points,
    required this.award,
    required this.onEdit,
    required this.onStreak,
    required this.onPoints,
    required this.onAward,
  });

  final String name;
  final String email;
  final String? program;
  final int? targetYear;
  final String city;
  final int streak;
  final int points;
  final String? award;
  final VoidCallback onEdit;
  final VoidCallback onStreak;
  final VoidCallback onPoints;
  final VoidCallback onAward;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final goldRing = streak >= 1 || points > 0;
    final yearLabel = targetYear == null ? 'Later' : '$targetYear';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 22, 18, 20),
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
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 72,
                height: 72,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.10),
                  border: Border.all(
                    color: goldRing ? AppColors.gold : Colors.white24,
                    width: 1.5,
                  ),
                ),
                child: Text(
                  initialsOf(name).isEmpty ? 'S' : initialsOf(name),
                  style: t.titleLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 6),
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: t.headlineMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      email,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: t.bodySmall?.copyWith(color: Colors.white60),
                    ),
                  ],
                ),
              ),
              Material(
                color: Colors.white.withValues(alpha: 0.14),
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: onEdit,
                  child: const Padding(
                    padding: EdgeInsets.all(8),
                    child: Icon(
                      Icons.edit_rounded,
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (program != null && program!.trim().isNotEmpty)
                _HeroChip(program!),
              _HeroChip(yearLabel),
              if (city.isNotEmpty) _HeroChip(city),
            ],
          ),
          const SizedBox(height: 18),
          Container(height: 1, color: Colors.white.withValues(alpha: 0.15)),
          const SizedBox(height: 14),
          Row(
            children: [
              _HeroStat(label: 'Streak', value: '🔥 $streak', onTap: onStreak),
              _heroDivider(),
              _HeroStat(
                label: 'Points',
                value: '${_groupInt(points)} pts',
                onTap: onPoints,
              ),
              _heroDivider(),
              Expanded(
                child: GestureDetector(
                  onTap: onAward,
                  behavior: HitTestBehavior.opaque,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Award',
                        style: t.labelMedium?.copyWith(
                          color: Colors.white60,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 4),
                      MoneyText(
                        award,
                        style: t.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
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

  Widget _heroDivider() {
    return Container(
      width: 1,
      height: 36,
      margin: const EdgeInsets.symmetric(horizontal: 12),
      color: Colors.white.withValues(alpha: 0.15),
    );
  }
}

class _HeroChip extends StatelessWidget {
  const _HeroChip(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: t.labelMedium?.copyWith(
                color: Colors.white60,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: t.titleLarge?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CityCallout extends StatelessWidget {
  const _CityCallout({required this.onAdd});
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
      decoration: BoxDecoration(
        color: AppColors.goldSoft,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Show up on the leaderboard', style: t.titleMedium),
          const SizedBox(height: 6),
          Text(
            'Add your city. Ranks show initials and city only.',
            style: t.bodySmall,
          ),
          TextButton(onPressed: onAdd, child: const Text('Add city')),
        ],
      ),
    );
  }
}

class _AchievementsStrip extends StatelessWidget {
  const _AchievementsStrip({
    required this.items,
    required this.total,
    required this.onTap,
  });

  final List<Map<String, dynamic>> items;
  final int total;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('ACHIEVEMENTS', style: t.labelMedium),
        const SizedBox(height: 12),
        if (items.isEmpty)
          Text(
            'Earn badges from streaks, cards, and tests.',
            style: t.bodyMedium,
          )
        else
          GestureDetector(
            onTap: onTap,
            child: Row(
              children: [
                ..._visible().map((a) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: CircleAvatar(
                      radius: 28,
                      backgroundColor: achievementTint(a['tier']?.toString()),
                      child: Icon(
                        achievementIcon(a['iconKey']?.toString()),
                        color: AppColors.deep,
                      ),
                    ),
                  );
                }),
                if (total > 4)
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.bgLow,
                    child: Text(
                      '+${total - 3}',
                      style: t.titleMedium?.copyWith(color: AppColors.inkSoft),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  List<Map<String, dynamic>> _visible() {
    if (total > 4) return items.take(3).toList();
    return items;
  }
}

class _AboutYouCard extends StatelessWidget {
  const _AboutYouCard({
    required this.mobile,
    required this.classOrExam,
    required this.city,
    required this.state,
    required this.dob,
    required this.parent,
    required this.consent,
    required this.consented,
    required this.onEdit,
  });

  final String mobile;
  final String classOrExam;
  final String city;
  final String state;
  final String dob;
  final String parent;
  final String consent;
  final bool consented;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('ABOUT YOU', style: t.labelMedium),
            const Spacer(),
            TextButton(onPressed: onEdit, child: const Text('Edit')),
          ],
        ),
        MeritCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: _Fact(label: 'Mobile', value: mobile),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _Fact(label: 'Class / exam', value: classOrExam),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _Fact(label: 'City', value: city),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _Fact(label: 'State', value: state),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _Fact(label: 'Date of birth', value: dob),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _Fact(label: 'Parent / guardian', value: parent),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (consented)
                StatusChip(consent, tone: StatusTone.success)
              else
                TextButton(
                  onPressed: onEdit,
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                  ),
                  child: Text(
                    'Not yet — add consent',
                    style: t.bodySmall?.copyWith(color: AppColors.accent),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final empty = value == '—';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: t.bodySmall),
        const SizedBox(height: 4),
        Text(
          value,
          style: t.titleMedium?.copyWith(
            color: empty ? AppColors.muted : AppColors.ink,
          ),
        ),
      ],
    );
  }
}

class _AccountRow extends StatelessWidget {
  const _AccountRow({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.showDivider = true,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.bgLow,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, size: 18, color: AppColors.inkSoft),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: t.titleMedium),
                      if (subtitle != null) ...[
                        const SizedBox(height: 2),
                        Text(subtitle!, style: t.bodySmall),
                      ],
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
              ],
            ),
          ),
        ),
        if (showDivider)
          Divider(height: 1, color: AppColors.line.withValues(alpha: 0.15)),
      ],
    );
  }
}

class _EditProfileSheet extends StatefulWidget {
  const _EditProfileSheet({
    required this.name,
    required this.mobile,
    required this.classOrExam,
    required this.city,
    required this.state,
    required this.parent,
    required this.dob,
    required this.consent,
    required this.consentAt,
    required this.focusCity,
    required this.formatDob,
    required this.formatConsentAt,
    required this.onSave,
    required this.onCancel,
  });

  final TextEditingController name;
  final TextEditingController mobile;
  final TextEditingController classOrExam;
  final TextEditingController city;
  final TextEditingController state;
  final TextEditingController parent;
  final DateTime? dob;
  final bool consent;
  final String? consentAt;
  final bool focusCity;
  final String Function(DateTime?) formatDob;
  final String Function(String?) formatConsentAt;
  final Future<String?> Function({
    required DateTime? dob,
    required bool consent,
  })
  onSave;
  final Future<void> Function() onCancel;

  @override
  State<_EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends State<_EditProfileSheet> {
  late DateTime? _dob = widget.dob;
  late bool _consent = widget.consent;
  final _cityFocus = FocusNode();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.focusCity) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _cityFocus.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    _cityFocus.dispose();
    super.dispose();
  }

  int? _age(DateTime? d) {
    if (d == null) return null;
    final now = DateTime.now();
    var age = now.year - d.year;
    if (now.month < d.month || (now.month == d.month && now.day < d.day))
      age -= 1;
    return age;
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dob ?? DateTime(now.year - 16),
      firstDate: DateTime(1950),
      lastDate: now,
    );
    if (picked != null && mounted) {
      setState(() => _dob = DateTime(picked.year, picked.month, picked.day));
    }
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await widget.onSave(dob: _dob, consent: _consent);
    if (!mounted) return;
    setState(() => _busy = false);
    if (err != null) {
      setState(() => _error = err);
      return;
    }
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final lockedConsent = widget.consent && widget.consentAt != null;
    final height = MediaQuery.sizeOf(context).height * 0.88;

    return SizedBox(
      height: height,
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.bgHigh,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 8, 8),
            child: Row(
              children: [
                Expanded(child: Text('Edit profile', style: t.headlineSmall)),
                IconButton(
                  onPressed: _busy ? null : widget.onCancel,
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              children: [
                if (_error != null) ...[
                  InlineError(_error!),
                  const SizedBox(height: 16),
                ],
                const FieldLabel('Full name'),
                TextField(
                  controller: widget.name,
                  textCapitalization: TextCapitalization.words,
                ),
                const SizedBox(height: 16),
                const FieldLabel('Mobile'),
                TextField(
                  controller: widget.mobile,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    hintText: '10-digit mobile',
                  ),
                ),
                const SizedBox(height: 16),
                const FieldLabel('Class / exam'),
                TextField(
                  controller: widget.classOrExam,
                  decoration: const InputDecoration(
                    hintText: 'e.g. Class 12 · JEE',
                  ),
                ),
                const SizedBox(height: 16),
                const FieldLabel('City'),
                TextField(controller: widget.city, focusNode: _cityFocus),
                const SizedBox(height: 16),
                const FieldLabel('State'),
                TextField(controller: widget.state),
                const SizedBox(height: 16),
                const FieldLabel('Date of birth'),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    _dob == null ? 'Tap to add' : widget.formatDob(_dob),
                    style: t.titleMedium,
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_dob != null)
                        IconButton(
                          tooltip: 'Clear',
                          onPressed: () => setState(() => _dob = null),
                          icon: const Icon(Icons.close_rounded),
                        ),
                      const Icon(Icons.calendar_today_outlined, size: 20),
                    ],
                  ),
                  onTap: _pickDob,
                ),
                if (_age(_dob) != null && _age(_dob)! < 18)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      'Under 18 — add a parent or guardian name so admin can see consent is supported.',
                      style: t.bodySmall,
                    ),
                  ),
                const FieldLabel('Parent / guardian'),
                TextField(controller: widget.parent),
                const SizedBox(height: 16),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _consent,
                  onChanged: lockedConsent
                      ? null
                      : (v) => setState(() => _consent = v ?? false),
                  controlAffinity: ListTileControlAffinity.leading,
                  activeColor: AppColors.accent,
                  title: Text(
                    lockedConsent
                        ? 'I accept the terms and consent to process my profile data (accepted ${widget.formatConsentAt(widget.consentAt)}). To withdraw later, use Help & support.'
                        : 'I accept the terms and consent to process my profile data',
                    style: t.bodyMedium,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: Column(
              children: [
                PrimaryButton(
                  label: 'Save changes',
                  busy: _busy,
                  onPressed: _submit,
                ),
                const SizedBox(height: 10),
                SecondaryButton(
                  label: 'Cancel',
                  onPressed: _busy ? null : widget.onCancel,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PasswordSheet extends StatefulWidget {
  const _PasswordSheet({
    required this.currentPassword,
    required this.newPassword,
    required this.confirmPassword,
    required this.onSave,
    required this.onCancel,
  });

  final TextEditingController currentPassword;
  final TextEditingController newPassword;
  final TextEditingController confirmPassword;
  final Future<String?> Function() onSave;
  final VoidCallback onCancel;

  @override
  State<_PasswordSheet> createState() => _PasswordSheetState();
}

class _PasswordSheetState extends State<_PasswordSheet> {
  bool _busy = false;
  String? _error;
  bool _showCurrent = false;
  bool _showNew = false;
  bool _showConfirm = false;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await widget.onSave();
    if (!mounted) return;
    setState(() => _busy = false);
    if (err != null) {
      setState(() => _error = err);
      return;
    }
    Navigator.of(context).pop(true);
  }

  InputDecoration _obscureDecoration(
    String hint,
    bool visible,
    VoidCallback toggle,
  ) {
    return InputDecoration(
      hintText: hint,
      suffixIcon: IconButton(
        onPressed: toggle,
        icon: Icon(
          visible ? Icons.visibility_off_outlined : Icons.visibility_outlined,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final height = MediaQuery.sizeOf(context).height * 0.72;

    return SizedBox(
      height: height,
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.bgHigh,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 8, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text('Change password', style: t.headlineSmall),
                ),
                IconButton(
                  onPressed: _busy ? null : widget.onCancel,
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              children: [
                if (_error != null) ...[
                  InlineError(_error!),
                  const SizedBox(height: 16),
                ],
                const FieldLabel('Current password'),
                TextField(
                  controller: widget.currentPassword,
                  obscureText: !_showCurrent,
                  enableSuggestions: false,
                  autocorrect: false,
                  autofillHints: const [AutofillHints.password],
                  decoration: _obscureDecoration('', _showCurrent, () {
                    setState(() => _showCurrent = !_showCurrent);
                  }),
                ),
                const SizedBox(height: 16),
                const FieldLabel('New password'),
                TextField(
                  controller: widget.newPassword,
                  obscureText: !_showNew,
                  enableSuggestions: false,
                  autocorrect: false,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: _obscureDecoration(
                    'At least 8 characters',
                    _showNew,
                    () {
                      setState(() => _showNew = !_showNew);
                    },
                  ),
                ),
                const SizedBox(height: 16),
                const FieldLabel('Confirm new password'),
                TextField(
                  controller: widget.confirmPassword,
                  obscureText: !_showConfirm,
                  enableSuggestions: false,
                  autocorrect: false,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: _obscureDecoration('', _showConfirm, () {
                    setState(() => _showConfirm = !_showConfirm);
                  }),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: Column(
              children: [
                PrimaryButton(
                  label: 'Update password',
                  busy: _busy,
                  onPressed: _submit,
                ),
                const SizedBox(height: 10),
                SecondaryButton(
                  label: 'Cancel',
                  onPressed: _busy ? null : widget.onCancel,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String _groupInt(int n) {
  final s = n.toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
    buf.write(s[i]);
  }
  return buf.toString();
}
