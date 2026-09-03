import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';
import '../about/about_screen.dart';
import '../legal/legal_screen.dart';
import '../leaderboard/leaderboard_screen.dart';
import '../support/support_screen.dart';
import '../curriculum/curriculum_screen.dart';
import '../wallet/wallet_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.api, required this.onSignOut});

  final ApiClient api;
  final Future<void> Function() onSignOut;

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
  bool _loading = true;
  bool _busy = false;
  bool _editing = false;
  bool _changingPassword = false;
  bool _pwBusy = false;
  String? _error;
  String? _msg;
  String? _pwError;
  String? _pwMsg;

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
      final res = await widget.api.request('GET', '/api/v1/me', auth: true);
      final data = res['data'] as Map<String, dynamic>;
      final user = data['user'] as Map<String, dynamic>? ?? {};
      final profile = data['profile'] as Map<String, dynamic>? ?? {};
      final curriculum = data['curriculum'] as Map<String, dynamic>?;
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
      setState(() => _loading = false);
    } on ApiException catch (e) {
      setState(() {
        _loading = false;
        _error = e.message;
      });
    }
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
      _msg = null;
    });
    try {
      await widget.api.request(
        'PATCH',
        '/api/v1/me/profile',
        auth: true,
        body: {
          if (_name.text.trim().isNotEmpty) 'fullName': _name.text.trim(),
          'mobile': _mobile.text.trim().isEmpty ? null : _mobile.text.trim(),
          'classOrExam': _classOrExam.text.trim().isEmpty ? null : _classOrExam.text.trim(),
          'city': _city.text.trim().isEmpty ? null : _city.text.trim(),
          'state': _state.text.trim().isEmpty ? null : _state.text.trim(),
          'parentGuardian': _parent.text.trim().isEmpty ? null : _parent.text.trim(),
          'dateOfBirth': _dob == null ? null : _toYmd(_dob!),
          if (_consent) 'consentAccepted': true,
        },
      );
      setState(() {
        _msg = 'Profile saved';
        _editing = false;
      });
      await _load(silent: true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancelEdit() async {
    setState(() {
      _editing = false;
      _error = null;
      _msg = null;
    });
    await _load(silent: true);
  }

  void _resetPasswordForm() {
    _currentPassword.clear();
    _newPassword.clear();
    _confirmPassword.clear();
    setState(() {
      _changingPassword = false;
      _pwError = null;
    });
  }

  Future<void> _changePassword() async {
    if (_newPassword.text != _confirmPassword.text) {
      setState(() {
        _pwError = 'New passwords do not match';
        _pwMsg = null;
      });
      return;
    }
    if (_newPassword.text.length < 8) {
      setState(() {
        _pwError = 'New password must be at least 8 characters';
        _pwMsg = null;
      });
      return;
    }
    setState(() {
      _pwBusy = true;
      _pwError = null;
      _pwMsg = null;
    });
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
      setState(() {
        _pwMsg = 'Password updated';
        _changingPassword = false;
      });
    } on ApiException catch (e) {
      setState(() => _pwError = e.message);
    } finally {
      if (mounted) setState(() => _pwBusy = false);
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
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  String _formatConsentAt(String? iso) {
    final d = _parseDob(iso);
    return d == null ? '' : _formatDob(d);
  }

  int? _age(DateTime? d) {
    if (d == null) return null;
    final now = DateTime.now();
    var age = now.year - d.year;
    if (now.month < d.month || (now.month == d.month && now.day < d.day)) age -= 1;
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

  String _consentLabel() {
    if (!_consent) return 'Not yet';
    final when = _formatConsentAt(_consentAt);
    return when.isEmpty ? 'Accepted' : 'Accepted · $when';
  }

  String _display(String value) => value.trim().isEmpty ? '—' : value.trim();

  Widget _infoRow(String label, String value) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 112,
            child: Text(label, style: t.bodySmall),
          ),
          Expanded(child: Text(_display(value), style: t.titleMedium)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;

    return SafeArea(
      child: FadeRise(
        child: _loading
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 120),
                children: [
                  const ScreenHeader(
                    overline: 'Account',
                    title: 'My profile',
                    subtitle: 'Keep your scholarship details up to date.',
                    ),
                  if (_city.text.trim().isEmpty) ...[
                    const SizedBox(height: 16),
                    Text(
                      'Add your city so you can appear on the leaderboard (initials only).',
                      style: t.bodySmall,
                    ),
                  ],
                  const SizedBox(height: 20),
                  MeritCard(
                    child: Row(
                      children: [
                        const BrandMark(size: 52),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _name.text.trim().isEmpty ? 'Student' : _name.text.trim(),
                                style: t.titleLarge,
                              ),
                              const SizedBox(height: 4),
                              Text(_email ?? '—', style: t.bodySmall),
                            ],
                          ),
                        ),
                        if (!_editing)
                          TextButton(
                            onPressed: () => setState(() {
                              _editing = true;
                              _error = null;
                              _msg = null;
                            }),
                            child: const Text('Edit'),
                          ),
                      ],
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    InlineError(_error!),
                  ],
                  if (_msg != null) ...[
                    const SizedBox(height: 12),
                    Text(_msg!, style: t.bodyMedium?.copyWith(color: AppColors.success)),
                  ],
                  if (_pwMsg != null) ...[
                    const SizedBox(height: 12),
                    Text(_pwMsg!, style: t.bodyMedium?.copyWith(color: AppColors.success)),
                  ],
                  const SizedBox(height: 20),
                  if (!_editing)
                    MeritCard(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                      child: Column(
                        children: [
                          _infoRow('Email', _email ?? ''),
                          const Divider(height: 1),
                          _infoRow('Mobile', _mobile.text),
                          const Divider(height: 1),
                          _infoRow('Class / exam', _classOrExam.text),
                          const Divider(height: 1),
                          _infoRow('Program', _programName ?? ''),
                          const Divider(height: 1),
                          _infoRow('Target year', _targetYear == null ? 'Later' : '$_targetYear'),
                          const Divider(height: 1),
                          _infoRow('City', _city.text),
                          const Divider(height: 1),
                          _infoRow('State', _state.text),
                          const Divider(height: 1),
                          _infoRow('Date of birth', _formatDob(_dob)),
                          const Divider(height: 1),
                          _infoRow('Parent / guardian', _parent.text),
                          const Divider(height: 1),
                          _infoRow('Consent', _consentLabel()),
                        ],
                      ),
                    )
                  else ...[
                    MeritCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const FieldLabel('Full name'),
                          TextField(
                            controller: _name,
                            textCapitalization: TextCapitalization.words,
                          ),
                          const SizedBox(height: 16),
                          const FieldLabel('Mobile'),
                          TextField(
                            controller: _mobile,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(hintText: '10-digit mobile'),
                          ),
                          const SizedBox(height: 16),
                          const FieldLabel('Class / exam'),
                          TextField(
                            controller: _classOrExam,
                            decoration: const InputDecoration(hintText: 'e.g. Class 12 · JEE'),
                          ),
                          const SizedBox(height: 16),
                          const FieldLabel('City'),
                          TextField(controller: _city),
                          const SizedBox(height: 16),
                          const FieldLabel('State'),
                          TextField(controller: _state),
                          const SizedBox(height: 16),
                          const FieldLabel('Date of birth'),
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              _dob == null ? 'Tap to add' : _formatDob(_dob),
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
                          const SizedBox(height: 8),
                          const FieldLabel('Parent / guardian'),
                          TextField(controller: _parent),
                          const SizedBox(height: 16),
                          CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            value: _consent,
                            onChanged: _consent && _consentAt != null
                                ? null
                                : (v) => setState(() => _consent = v ?? false),
                            controlAffinity: ListTileControlAffinity.leading,
                            activeColor: AppColors.accent,
                            title: Text(
                              _consent && _consentAt != null
                                  ? 'I accept the terms and consent to process my profile data (accepted ${_formatConsentAt(_consentAt)}). To withdraw later, use Help & support.'
                                  : 'I accept the terms and consent to process my profile data',
                              style: t.bodyMedium,
                            ),
                          ),
                          const SizedBox(height: 12),
                          PrimaryButton(label: 'Save changes', busy: _busy, onPressed: _save),
                          const SizedBox(height: 10),
                          SecondaryButton(label: 'Cancel', onPressed: _busy ? null : _cancelEdit),
                        ],
                      ),
                    ),
                  ],
                  if (!_editing && _city.text.trim().isEmpty) ...[
                    const SizedBox(height: 16),
                    Text(
                      'Add your city so you can appear on the leaderboard (initials only).',
                      style: t.bodySmall,
                    ),
                  ],
                  const SizedBox(height: 20),
                  if (_pwError != null) ...[
                    InlineError(_pwError!),
                    const SizedBox(height: 12),
                  ],
                  if (!_changingPassword)
                    SecondaryButton(
                      label: 'Change password',
                      onPressed: () => setState(() {
                        _changingPassword = true;
                        _pwError = null;
                        _pwMsg = null;
                      }),
                    )
                  else
                    MeritCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Change password', style: t.titleLarge),
                          const SizedBox(height: 16),
                          const FieldLabel('Current password'),
                          TextField(
                            controller: _currentPassword,
                            obscureText: true,
                            enableSuggestions: false,
                            autocorrect: false,
                            autofillHints: const [AutofillHints.password],
                          ),
                          const SizedBox(height: 16),
                          const FieldLabel('New password'),
                          TextField(
                            controller: _newPassword,
                            obscureText: true,
                            enableSuggestions: false,
                            autocorrect: false,
                            autofillHints: const [AutofillHints.newPassword],
                            decoration: const InputDecoration(hintText: 'At least 8 characters'),
                          ),
                          const SizedBox(height: 16),
                          const FieldLabel('Confirm new password'),
                          TextField(
                            controller: _confirmPassword,
                            obscureText: true,
                            enableSuggestions: false,
                            autocorrect: false,
                            autofillHints: const [AutofillHints.newPassword],
                          ),
                          const SizedBox(height: 16),
                          PrimaryButton(
                            label: 'Update password',
                            busy: _pwBusy,
                            onPressed: _changePassword,
                          ),
                          const SizedBox(height: 10),
                          SecondaryButton(
                            label: 'Cancel',
                            onPressed: _pwBusy ? null : _resetPasswordForm,
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 28),
                  const Divider(height: 1),
                  const SizedBox(height: 8),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('Leaderboard', style: t.titleMedium),
                    subtitle: Text('Program ranks with initials and city only', style: t.bodySmall),
                    trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                    onTap: () => openLeaderboard(context, widget.api),
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('Wallet', style: t.titleMedium),
                    subtitle: Text('Deposited, awards, and sandbox top-ups', style: t.bodySmall),
                    trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                    onTap: () {
                      Navigator.of(context).push(
                        PageRouteBuilder(
                          pageBuilder: (context, animation, secondaryAnimation) => Scaffold(
                            body: AppAtmosphere(child: WalletScreen(api: widget.api)),
                          ),
                          transitionsBuilder: (context, animation, secondaryAnimation, child) =>
                              FadeTransition(opacity: animation, child: child),
                          transitionDuration: const Duration(milliseconds: 200),
                        ),
                      );
                    },
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('Rebuild curriculum', style: t.titleMedium),
                    subtitle: Text(
                      'Change program or target year. Your question bank stays.',
                      style: t.bodySmall,
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                    onTap: () {
                      Navigator.of(context).push(
                        PageRouteBuilder(
                          pageBuilder: (context, animation, secondaryAnimation) => CurriculumScreen(
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
                    },
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('About Rising Rankers', style: t.titleMedium),
                    subtitle: Text('What the app is, and the version on this device', style: t.bodySmall),
                    trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                    onTap: () {
                      Navigator.of(context).push(
                        PageRouteBuilder(
                          pageBuilder: (context, animation, secondaryAnimation) =>
                              AboutScreen(api: widget.api),
                          transitionsBuilder: (context, animation, secondaryAnimation, child) =>
                              FadeTransition(opacity: animation, child: child),
                          transitionDuration: const Duration(milliseconds: 200),
                        ),
                      );
                    },
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('Help & support', style: t.titleMedium),
                    subtitle: Text('Tickets for payments, tests, and account issues', style: t.bodySmall),
                    trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                    onTap: () {
                      Navigator.of(context).push(
                        PageRouteBuilder(
                          pageBuilder: (context, animation, secondaryAnimation) =>
                              SupportScreen(api: widget.api),
                          transitionsBuilder: (context, animation, secondaryAnimation, child) =>
                              FadeTransition(opacity: animation, child: child),
                          transitionDuration: const Duration(milliseconds: 200),
                        ),
                      );
                    },
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('Legal, FAQ & policies', style: t.titleMedium),
                    trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                    onTap: () {
                      Navigator.of(context).push(
                        PageRouteBuilder(
                          pageBuilder: (context, animation, secondaryAnimation) =>
                              const LegalScreen(),
                          transitionsBuilder: (context, animation, secondaryAnimation, child) =>
                              FadeTransition(opacity: animation, child: child),
                          transitionDuration: const Duration(milliseconds: 200),
                        ),
                      );
                    },
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      'Sign out',
                      style: t.titleMedium?.copyWith(color: AppColors.danger),
                    ),
                    onTap: widget.onSignOut,
                  ),
                ],
              ),
      ),
    );
  }
}
