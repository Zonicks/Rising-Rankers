import 'package:flutter/material.dart';
import '../../core/prefs.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onDone});

  final VoidCallback onDone;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingPage {
  const _OnboardingPage({
    required this.icon,
    required this.color,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String body;
}

const _pages = [
  _OnboardingPage(
    icon: Icons.style_rounded,
    color: AppColors.accent,
    title: 'Practice that actually sticks',
    body: 'Flip flash cards and drill MCQs from real chapters. A little every day compounds into exam confidence.',
  ),
  _OnboardingPage(
    icon: Icons.timer_rounded,
    color: AppColors.deepMid,
    title: 'Compete in live scholarship tests',
    body: 'Join timed contests, stay on one device, and climb the board. Strong, fair scores can earn Award credit.',
  ),
  _OnboardingPage(
    icon: Icons.workspace_premium_rounded,
    color: AppColors.gold,
    title: 'Win awards you can withdraw',
    body: 'Scholarship winnings land in your Award wallet. Practice is free to start. Compete when you are ready.',
  ),
];

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    await AppPrefs.setOnboardingSeen();
    widget.onDone();
  }

  void _next() {
    if (_index >= _pages.length - 1) {
      _finish();
      return;
    }
    _controller.nextPage(duration: const Duration(milliseconds: 380), curve: Curves.easeOutCubic);
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final last = _index == _pages.length - 1;

    return Scaffold(
      body: AppAtmosphere(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
            child: Column(
              children: [
                Row(
                  children: [
                    const BrandMark(size: 40),
                    const SizedBox(width: 10),
                    Text(AppTheme.brandName, style: t.titleLarge?.copyWith(color: AppColors.accent)),
                    const Spacer(),
                    TextButton(onPressed: _finish, child: const Text('Skip')),
                  ],
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _controller,
                    itemCount: _pages.length,
                    onPageChanged: (i) => setState(() => _index = i),
                    itemBuilder: (context, i) {
                      final page = _pages[i];
                      return Column(
                        children: [
                          const Spacer(),
                          IconBurst(icon: page.icon, color: page.color),
                          const SizedBox(height: 36),
                          Text(page.title, textAlign: TextAlign.center, style: t.displayMedium),
                          const SizedBox(height: 14),
                          Text(page.body, textAlign: TextAlign.center, style: t.bodyLarge),
                          const Spacer(flex: 2),
                        ],
                      );
                    },
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(_pages.length, (i) {
                    final active = i == _index;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      height: 8,
                      width: active ? 26 : 8,
                      decoration: BoxDecoration(
                        color: active ? AppColors.accent : AppColors.lineStrong,
                        borderRadius: BorderRadius.circular(8),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 28),
                PrimaryButton(
                  label: last ? 'Get started' : 'Continue',
                  onPressed: _next,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
