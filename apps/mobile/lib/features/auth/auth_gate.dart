import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/prefs.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';
import '../home/home_shell.dart';
import '../onboarding/onboarding_screen.dart';
import '../curriculum/curriculum_screen.dart';
import 'auth_screen.dart';

class AuthGate extends StatefulWidget {
  const AuthGate({super.key, required this.api});

  final ApiClient api;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _loading = true;
  bool _authed = false;
  bool _onboarded = false;
  bool _curriculumReady = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final seen = await AppPrefs.onboardingSeen();
    final token = await widget.api.getToken();
    if (token == null) {
      setState(() {
        _onboarded = seen;
        _loading = false;
        _authed = false;
        _curriculumReady = false;
      });
      return;
    }
    try {
      final res = await widget.api.request('GET', '/api/v1/me', auth: true);
      final data = res['data'] as Map<String, dynamic>? ?? {};
      final profile = data['profile'] as Map<String, dynamic>?;
      setState(() {
        _onboarded = true;
        _loading = false;
        _authed = true;
        _curriculumReady = profile?['curriculumComplete'] == true;
      });
    } catch (_) {
      await widget.api.setToken(null);
      setState(() {
        _onboarded = seen;
        _loading = false;
        _authed = false;
        _curriculumReady = false;
      });
    }
  }

  Future<void> _onAuthed() async {
    try {
      final res = await widget.api.request('GET', '/api/v1/me', auth: true);
      final data = res['data'] as Map<String, dynamic>? ?? {};
      final profile = data['profile'] as Map<String, dynamic>?;
      setState(() {
        _authed = true;
        _curriculumReady = profile?['curriculumComplete'] == true;
      });
    } catch (_) {
      setState(() {
        _authed = true;
        _curriculumReady = false;
      });
    }
  }

  Future<void> _onSignOut() async {
    await widget.api.setToken(null);
    final seen = await AppPrefs.onboardingSeen();
    setState(() {
      _authed = false;
      _onboarded = seen;
      _curriculumReady = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        body: AppAtmosphere(
          child: Center(
            child: FadeRise(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const BrandMark(size: 72),
                  const SizedBox(height: 20),
                  Text(
                    AppTheme.brandName,
                    style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                          color: AppColors.accent,
                          letterSpacing: -0.4,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(AppTheme.brandTagline, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 28),
                  const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    if (!_authed && !_onboarded) {
      return OnboardingScreen(onDone: () => setState(() => _onboarded = true));
    }
    if (!_authed) {
      return AuthScreen(api: widget.api, onSuccess: _onAuthed);
    }
    if (!_curriculumReady) {
      return CurriculumScreen(
        api: widget.api,
        onDone: () => setState(() => _curriculumReady = true),
        onBackToAuth: _onSignOut,
      );
    }
    return HomeShell(api: widget.api, onSignOut: _onSignOut);
  }
}
