import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/skeleton.dart';
import '../../ui/widgets.dart';

class CurriculumScreen extends StatefulWidget {
  const CurriculumScreen({
    super.key,
    required this.api,
    required this.onDone,
    this.onBackToAuth,
    this.rebuild = false,
  });

  final ApiClient api;
  final VoidCallback onDone;
  final VoidCallback? onBackToAuth;
  final bool rebuild;

  @override
  State<CurriculumScreen> createState() => _CurriculumScreenState();
}

class _CurriculumScreenState extends State<CurriculumScreen> {
  final _first = TextEditingController();
  final _last = TextEditingController();
  List<Map<String, dynamic>> _programs = [];
  String? _programId;
  int? _year;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  List<int> get _years {
    final y = DateTime.now().year;
    return [y, y + 1, y + 2];
  }

  @override
  void initState() {
    super.initState();
    _year = DateTime.now().year + 1;
    _load();
  }

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final meRes = await widget.api.request('GET', '/api/v1/me', auth: true);
      final progRes = await widget.api.request(
        'GET',
        '/api/v1/programs',
        auth: true,
      );
      final me = meRes['data'] as Map<String, dynamic>;
      final user = me['user'] as Map<String, dynamic>? ?? {};
      final profile = me['profile'] as Map<String, dynamic>?;
      final curriculum = me['curriculum'] as Map<String, dynamic>?;
      if (profile?['curriculumComplete'] == true && !widget.rebuild) {
        widget.onDone();
        return;
      }
      final programs = (progRes['data'] as List? ?? [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();

      final full = (user['fullName'] ?? '').toString().trim();
      final parts = full
          .split(RegExp(r'\s+'))
          .where((p) => p.isNotEmpty)
          .toList();
      _first.text = (user['firstName'] ?? (parts.isNotEmpty ? parts.first : ''))
          .toString();
      _last.text =
          (user['lastName'] ??
                  (parts.length > 1 ? parts.sublist(1).join(' ') : ''))
              .toString();

      setState(() {
        _programs = programs;
        _programId =
            curriculum?['programId']?.toString() ??
            (programs.isNotEmpty ? programs.first['id']?.toString() : null);
        if (curriculum == null) {
          _year = DateTime.now().year + 1;
        } else {
          final ty = curriculum['targetYear'];
          _year = ty is num ? ty.toInt() : null;
        }
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _loading = false;
        _error = e.message;
      });
    }
  }

  void _back() {
    if (widget.rebuild) {
      Navigator.of(context).maybePop();
      return;
    }
    widget.onBackToAuth?.call();
  }

  Future<void> _submit() async {
    if (_programId == null) {
      setState(() => _error = 'Choose a program');
      return;
    }
    if (_first.text.trim().isEmpty || _last.text.trim().isEmpty) {
      setState(() => _error = 'Enter your first and last name');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.request(
        'POST',
        '/api/v1/me/curriculum',
        auth: true,
        body: {
          'firstName': _first.text.trim(),
          'lastName': _last.text.trim(),
          'programId': _programId,
          'targetYear': _year,
        },
      );
      widget.onDone();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _chip(String label, bool on, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        decoration: BoxDecoration(
          color: on ? AppColors.accent : AppColors.bgElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: on ? Colors.transparent : AppColors.line),
          boxShadow: on ? AppShadows.lift : null,
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: on ? Colors.white : AppColors.inkSoft,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;

    return Scaffold(
      body: AppAtmosphere(
        child: SafeArea(
          child: _loading
              ? ListView(
                  padding: const EdgeInsets.fromLTRB(22, 8, 22, 32),
                  children: [
                    Row(
                      children: [
                        IconButton(
                          onPressed: _back,
                          icon: const Icon(
                            Icons.arrow_back_rounded,
                            color: AppColors.accent,
                          ),
                        ),
                        const BrandMark(size: 32),
                        const SizedBox(width: 10),
                        Text(
                          AppTheme.brandName,
                          style: t.titleLarge?.copyWith(
                            color: AppColors.accent,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    const CurriculumSkeleton(),
                  ],
                )
              : FadeRise(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(22, 8, 22, 32),
                    children: [
                      Row(
                        children: [
                          IconButton(
                            onPressed: _back,
                            icon: const Icon(
                              Icons.arrow_back_rounded,
                              color: AppColors.accent,
                            ),
                          ),
                          const BrandMark(size: 32),
                          const SizedBox(width: 10),
                          Text(
                            AppTheme.brandName,
                            style: t.titleLarge?.copyWith(
                              color: AppColors.accent,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 28),
                      Center(
                        child: Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            color: AppColors.accent,
                            shape: BoxShape.circle,
                            boxShadow: AppShadows.lift,
                          ),
                          child: const Icon(
                            Icons.person_outline_rounded,
                            color: Colors.white,
                            size: 36,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        "Let's set the stage for your success.",
                        textAlign: TextAlign.center,
                        style: t.headlineLarge?.copyWith(
                          color: AppColors.accent,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Help us personalize your learning path. This takes less than a minute.',
                        textAlign: TextAlign.center,
                        style: t.bodyMedium,
                      ),
                      const SizedBox(height: 28),
                      Container(
                        padding: const EdgeInsets.all(22),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F3FB),
                          borderRadius: BorderRadius.circular(28),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const FieldLabel('First name'),
                            TextField(
                              controller: _first,
                              textCapitalization: TextCapitalization.words,
                              decoration: const InputDecoration(
                                hintText: 'Arjun',
                              ),
                            ),
                            const SizedBox(height: 16),
                            const FieldLabel('Last name'),
                            TextField(
                              controller: _last,
                              textCapitalization: TextCapitalization.words,
                              decoration: const InputDecoration(
                                hintText: 'Sharma',
                              ),
                            ),
                            const SizedBox(height: 22),
                            Text(
                              'TARGET PROGRAM',
                              style: t.labelMedium?.copyWith(
                                color: AppColors.accent,
                              ),
                            ),
                            const SizedBox(height: 10),
                            if (_programs.isEmpty)
                              Text(
                                'No programs yet. Ask an admin to add one in Syllabus.',
                                style: t.bodySmall,
                              )
                            else
                              GridView.count(
                                crossAxisCount: 2,
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                mainAxisSpacing: 10,
                                crossAxisSpacing: 10,
                                childAspectRatio: 2.2,
                                children: [
                                  for (final p in _programs)
                                    _chip(
                                      p['name']?.toString() ?? 'Program',
                                      _programId == p['id']?.toString(),
                                      () => setState(
                                        () => _programId = p['id']?.toString(),
                                      ),
                                    ),
                                ],
                              ),
                            const SizedBox(height: 22),
                            Text(
                              'TARGET YEAR',
                              style: t.labelMedium?.copyWith(
                                color: AppColors.accent,
                              ),
                            ),
                            const SizedBox(height: 10),
                            GridView.count(
                              crossAxisCount: 2,
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              mainAxisSpacing: 10,
                              crossAxisSpacing: 10,
                              childAspectRatio: 2.2,
                              children: [
                                for (final y in _years)
                                  _chip(
                                    '$y',
                                    _year == y,
                                    () => setState(() => _year = y),
                                  ),
                                _chip(
                                  'Later',
                                  _year == null,
                                  () => setState(() => _year = null),
                                ),
                              ],
                            ),
                            const SizedBox(height: 18),
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AppColors.accentSoft.withValues(
                                  alpha: 0.7,
                                ),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: AppColors.accent.withValues(
                                    alpha: 0.1,
                                  ),
                                ),
                              ),
                              child: Text.rich(
                                TextSpan(
                                  style: t.bodySmall?.copyWith(
                                    color: AppColors.inkSoft,
                                    height: 1.45,
                                  ),
                                  children: const [
                                    TextSpan(
                                      text: 'This helps us tailor your ',
                                    ),
                                    TextSpan(
                                      text: 'Daily Study Plan',
                                      style: TextStyle(
                                        color: AppColors.accent,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    TextSpan(
                                      text:
                                          ' and current affairs to your timeline.',
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 16),
                        InlineError(_error!),
                      ],
                      const SizedBox(height: 22),
                      PrimaryButton(
                        label: _busy ? 'Building…' : 'Build My Curriculum',
                        busy: _busy,
                        onPressed: _submit,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'By continuing, you agree to our Terms of Service',
                        textAlign: TextAlign.center,
                        style: t.bodySmall,
                      ),
                      const SizedBox(height: 28),
                      Container(
                        height: 140,
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(28),
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              AppColors.deep,
                              AppColors.deepMid,
                              AppColors.accent,
                            ],
                          ),
                        ),
                        child: const Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            BrandMark(size: 48, light: true),
                            Spacer(),
                            Text(
                              'Rise. Rank. Earn.',
                              style: TextStyle(
                                color: Colors.white70,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
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
