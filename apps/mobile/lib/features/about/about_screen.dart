import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/app_info.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';
import '../legal/legal_screen.dart';
import '../support/support_screen.dart';

String _platformLabel() {
  if (kIsWeb) return 'Web';
  return switch (defaultTargetPlatform) {
    TargetPlatform.android => 'Android',
    TargetPlatform.iOS => 'iOS',
    TargetPlatform.macOS => 'macOS',
    TargetPlatform.windows => 'Windows',
    TargetPlatform.linux => 'Linux',
    _ => 'App',
  };
}

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Scaffold(
      body: AppAtmosphere(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 4, 20, 0),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
                    ),
                    Text('About', style: t.titleLarge),
                  ],
                ),
              ),
              Expanded(
                child: FadeRise(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                    children: [
                      const ScreenHeader(
                        overline: 'Rising Rankers',
                        title: 'About',
                        subtitle: '$appName · Version $appVersion',
                      ),
                      const SizedBox(height: 20),
                      MeritCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const BrandMark(size: 56),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(appName, style: t.titleLarge),
                                      const SizedBox(height: 4),
                                      Text(appTagline, style: t.bodySmall),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                Chip(label: Text('Version $appVersion')),
                                Chip(label: Text('Build $appBuild')),
                                Chip(label: Text(_platformLabel())),
                              ],
                            ),
                            const SizedBox(height: 16),
                            for (final paragraph in aboutParagraphs) ...[
                              Text(paragraph, style: t.bodyMedium),
                              const SizedBox(height: 12),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      HairlineListTile(
                        title: 'Help & support',
                        subtitle: 'Tickets for payments, tests, and account issues',
                        trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                        onTap: () => pushFade(context, SupportScreen(api: api)),
                      ),
                      HairlineListTile(
                        title: 'Legal, FAQ & policies',
                        trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                        showDivider: false,
                        onTap: () => pushFade(context, const LegalScreen()),
                      ),
                    ],
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
