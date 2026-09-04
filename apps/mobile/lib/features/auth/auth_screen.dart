import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';
import '../legal/legal_copy.dart';
import '../legal/legal_detail_screen.dart';
import '../legal/legal_screen.dart';
import '../onboarding/onboarding_scenes.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.api, required this.onSuccess});

  final ApiClient api;
  final VoidCallback onSuccess;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _signUp = false;
  bool _busy = false;
  bool _hidePassword = true;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final path = _signUp ? '/api/v1/auth/signup' : '/api/v1/auth/signin';
      final body = <String, dynamic>{
        'email': _email.text.trim(),
        'password': _password.text,
        if (_signUp && _name.text.trim().isNotEmpty)
          'fullName': _name.text.trim(),
      };
      final res = await widget.api.request('POST', path, body: body);
      final data = res['data'] as Map<String, dynamic>;
      await widget.api.setToken(data['token'] as String);
      widget.onSuccess();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _openLegal(String title) {
    final doc = legalDocs.firstWhere((d) => d.title == title);
    pushFade(context, LegalDetailScreen(doc: doc));
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final safeBottom = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: DecoratedBox(
        decoration: const BoxDecoration(color: AppColors.bg),
        child: SafeArea(
          bottom: false,
          child: FadeRise(
            child: SingleChildScrollView(
              padding: EdgeInsets.only(bottom: 28 + bottomInset + safeBottom),
              child: Column(
                children: [
                  SizedBox(
                    height: 214,
                    width: double.infinity,
                    child: Stack(
                      children: [
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                AppColors.deep,
                                AppColors.deepMid,
                                AppColors.accent,
                              ],
                            ),
                          ),
                          child: SizedBox.expand(),
                        ),
                        Positioned(
                          right: -12,
                          bottom: 28,
                          child: IgnorePointer(
                            child: Opacity(
                              opacity: 0.92,
                              child: Transform.scale(
                                scale: 0.72,
                                alignment: Alignment.bottomRight,
                                child: const OnboardingDeckScene(compact: true),
                              ),
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(22, 20, 22, 36),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const BrandMark(size: 48),
                              const SizedBox(height: 14),
                              Text(
                                AppTheme.brandName,
                                style: t.headlineLarge?.copyWith(
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                AppTheme.brandTagline,
                                style: t.titleMedium?.copyWith(
                                  color: AppColors.gold,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Transform.translate(
                    offset: const Offset(0, -28),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
                        decoration: BoxDecoration(
                          color: AppColors.bgElevated,
                          borderRadius: BorderRadius.circular(AppRadii.xl),
                          boxShadow: AppShadows.lift,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _signUp ? 'Create your account' : 'Welcome back',
                              style: t.headlineLarge,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _signUp
                                  ? 'Create an account and start practising in under a minute.'
                                  : 'Your cards, tests, and awards are waiting.',
                              style: t.bodyMedium,
                            ),
                            const SizedBox(height: 18),
                            Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: AppColors.accentSoft,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Row(
                                children: [
                                  _modeChip(
                                    'Sign in',
                                    !_signUp,
                                    () => setState(() {
                                      _signUp = false;
                                      _error = null;
                                    }),
                                  ),
                                  _modeChip(
                                    'Create account',
                                    _signUp,
                                    () => setState(() {
                                      _signUp = true;
                                      _error = null;
                                    }),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 20),
                            if (_signUp) ...[
                              const FieldLabel('Full name'),
                              TextField(
                                controller: _name,
                                textCapitalization: TextCapitalization.words,
                                decoration: const InputDecoration(
                                  hintText: 'Your name',
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],
                            const FieldLabel('Email'),
                            TextField(
                              controller: _email,
                              keyboardType: TextInputType.emailAddress,
                              autofillHints: const [AutofillHints.email],
                              decoration: const InputDecoration(
                                hintText: 'you@example.com',
                              ),
                            ),
                            const SizedBox(height: 16),
                            const FieldLabel('Password'),
                            TextField(
                              controller: _password,
                              obscureText: _hidePassword,
                              autofillHints: [
                                _signUp
                                    ? AutofillHints.newPassword
                                    : AutofillHints.password,
                              ],
                              decoration: InputDecoration(
                                hintText: '••••••••',
                                suffixIcon: IconButton(
                                  onPressed: () => setState(
                                    () => _hidePassword = !_hidePassword,
                                  ),
                                  icon: Icon(
                                    _hidePassword
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    color: AppColors.muted,
                                  ),
                                ),
                              ),
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 16),
                              InlineError(_error!),
                            ],
                            const SizedBox(height: 22),
                            PrimaryButton(
                              label: _signUp ? 'Create account' : 'Sign in',
                              busy: _busy,
                              onPressed: _submit,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(28, 0, 28, 8),
                    child: Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          'By continuing you agree to Rising Rankers’ ',
                          style: t.bodySmall,
                        ),
                        _LegalLink('terms', () => _openLegal('Terms of use')),
                        Text(', ', style: t.bodySmall),
                        _LegalLink('privacy', () => _openLegal('Privacy')),
                        Text(', and ', style: t.bodySmall),
                        _LegalLink('fair play', () => _openLegal('Fair play')),
                        Text(' rules.', style: t.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _modeChip(String label, bool selected, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: _busy ? null : onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: AppColors.accent.withValues(alpha: 0.12),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: selected ? AppColors.accent : AppColors.inkSoft,
            ),
          ),
        ),
      ),
    );
  }
}

class _LegalLink extends StatelessWidget {
  const _LegalLink(this.label, this.onTap);

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: AppColors.accent,
          fontWeight: FontWeight.w700,
          decoration: TextDecoration.underline,
          decorationColor: AppColors.accent.withValues(alpha: 0.4),
        ),
      ),
    );
  }
}
