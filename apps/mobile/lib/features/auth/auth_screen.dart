import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';

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
        if (_signUp && _name.text.trim().isNotEmpty) 'fullName': _name.text.trim(),
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

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;

    return Scaffold(
      body: AppAtmosphere(
        child: SafeArea(
          child: FadeRise(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(22, 20, 22, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const BrandMark(size: 56),
                  const SizedBox(height: 18),
                  Text(
                    AppTheme.brandName,
                    style: t.displayLarge?.copyWith(color: AppColors.accent, letterSpacing: -0.8),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _signUp
                        ? 'Create an account and start practising in under a minute.'
                        : 'Welcome back. Your cards, tests, and awards are waiting.',
                    style: t.bodyLarge,
                  ),
                  const SizedBox(height: 28),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppColors.bgElevated,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Row(
                      children: [
                        _modeChip('Sign in', !_signUp, () => setState(() {
                              _signUp = false;
                              _error = null;
                            })),
                        _modeChip('Create account', _signUp, () => setState(() {
                              _signUp = true;
                              _error = null;
                            })),
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),
                  MeritCard(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_signUp) ...[
                          const FieldLabel('Full name'),
                          TextField(
                            controller: _name,
                            textCapitalization: TextCapitalization.words,
                            decoration: const InputDecoration(hintText: 'Your name'),
                          ),
                          const SizedBox(height: 16),
                        ],
                        const FieldLabel('Email'),
                        TextField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          decoration: const InputDecoration(hintText: 'you@example.com'),
                        ),
                        const SizedBox(height: 16),
                        const FieldLabel('Password'),
                        TextField(
                          controller: _password,
                          obscureText: _hidePassword,
                          autofillHints: [
                            _signUp ? AutofillHints.newPassword : AutofillHints.password,
                          ],
                          decoration: InputDecoration(
                            hintText: '••••••••',
                            suffixIcon: IconButton(
                              onPressed: () => setState(() => _hidePassword = !_hidePassword),
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
                  const SizedBox(height: 20),
                  Text(
                    'By continuing you agree to Rising Rankers’ terms, privacy, and fair play rules.',
                    style: t.bodySmall,
                    textAlign: TextAlign.center,
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
            color: selected ? AppColors.accent : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: selected ? Colors.white : AppColors.inkSoft,
                ),
          ),
        ),
      ),
    );
  }
}
