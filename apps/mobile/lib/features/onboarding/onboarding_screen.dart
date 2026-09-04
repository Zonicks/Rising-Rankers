import 'package:flutter/material.dart';
import '../../core/prefs.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';
import 'onboarding_scenes.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onDone});

  final VoidCallback onDone;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingPage {
  const _OnboardingPage({
    required this.overline,
    required this.title,
    required this.body,
  });

  final String overline;
  final String title;
  final String body;
}

const _pages = [
  _OnboardingPage(
    overline: 'Practice',
    title: 'Practice that actually sticks',
    body:
        'Flip cards and drill MCQs from real chapters. A little every day is enough.',
  ),
  _OnboardingPage(
    overline: 'Compete',
    title: 'Sit the live tests',
    body:
        'Timed contests. One device. Fair rank. Strong scores can earn Award credit.',
  ),
  _OnboardingPage(
    overline: 'Earn',
    title: 'Awards you can withdraw',
    body:
        'Winnings land in your Award wallet. Practice is free. Compete when you are ready.',
  ),
];

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;
  double _page = 0;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      if (!_controller.hasClients) return;
      setState(() => _page = _controller.page ?? _index.toDouble());
    });
  }

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
    _controller.nextPage(
      duration: const Duration(milliseconds: 380),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final last = _index == _pages.length - 1;
    final page = _pages[_index];

    return Scaffold(
      body: Column(
        children: [
          Expanded(
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
                        Color(0xFF132A5C),
                      ],
                    ),
                  ),
                  child: SizedBox.expand(),
                ),
                Positioned(
                  top: -80,
                  right: -60,
                  child: IgnorePointer(
                    child: Container(
                      width: 280,
                      height: 280,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            AppColors.accent.withValues(alpha: 0.45),
                            AppColors.accent.withValues(alpha: 0),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 40,
                  left: -70,
                  child: IgnorePointer(
                    child: Container(
                      width: 200,
                      height: 200,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            AppColors.gold.withValues(alpha: 0.18),
                            AppColors.gold.withValues(alpha: 0),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                PageView.builder(
                  controller: _controller,
                  itemCount: _pages.length,
                  onPageChanged: (i) => setState(() => _index = i),
                  itemBuilder: (context, i) {
                    final shift = ((_page - i) * 28).clamp(-36.0, 36.0);
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(24, 72, 24, 36),
                        child: OnboardingSceneSwitcher(
                          index: i,
                          parallax: -shift,
                        ),
                      ),
                    );
                  },
                ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 8, 0),
                    child: Row(
                      children: [
                        const BrandMark(size: 36),
                        const SizedBox(width: 8),
                        Text(
                          AppTheme.brandName,
                          style: t.titleMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const Spacer(),
                        TextButton(
                          onPressed: _finish,
                          child: Text(
                            'Skip',
                            style: t.titleMedium?.copyWith(
                              color: AppColors.gold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Material(
            color: AppColors.bg,
            clipBehavior: Clip.antiAlias,
            elevation: 0,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(AppRadii.hero),
            ),
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                24,
                28,
                24,
                28 + MediaQuery.paddingOf(context).bottom,
              ),
              child: Column(
                children: [
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 180),
                    child: Column(
                      key: ValueKey(_index),
                      children: [
                        Text(
                          page.overline.toUpperCase(),
                          style: t.labelMedium?.copyWith(
                            color: AppColors.gold,
                            letterSpacing: 1.6,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          page.title,
                          textAlign: TextAlign.center,
                          style: t.displayMedium,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          page.body,
                          textAlign: TextAlign.center,
                          style: t.bodyLarge?.copyWith(
                            color: AppColors.inkSoft,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_pages.length, (i) {
                      final active = i == _index;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        height: 7,
                        width: active ? 18 : 6,
                        decoration: BoxDecoration(
                          color: active
                              ? AppColors.gold
                              : AppColors.deep.withValues(alpha: 0.22),
                          borderRadius: BorderRadius.circular(99),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 22),
                  PrimaryButton(
                    label: last ? 'Get started' : 'Continue',
                    onPressed: _next,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
