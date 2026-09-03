import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';
import 'legal_copy.dart';
import 'legal_detail_screen.dart';

void pushFade(BuildContext context, Widget page) {
  Navigator.of(context).push(
    PageRouteBuilder(
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) =>
          FadeTransition(opacity: animation, child: child),
      transitionDuration: const Duration(milliseconds: 200),
    ),
  );
}

class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key});

  @override
  Widget build(BuildContext context) {
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
                    Text('Policies & help', style: Theme.of(context).textTheme.titleLarge),
                  ],
                ),
              ),
              Expanded(
                child: FadeRise(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                    children: [
                      const ScreenHeader(
                        overline: 'Legal',
                        title: 'Policies & help',
                        subtitle: 'Terms, privacy, contest rules, FAQ, and fair play.',
                      ),
                      const SizedBox(height: 12),
                      for (var i = 0; i < legalDocs.length; i++)
                        HairlineListTile(
                          title: legalDocs[i].title,
                          subtitle: legalDocs[i].blurb,
                          trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                          showDivider: i < legalDocs.length - 1,
                          onTap: () => pushFade(context, LegalDetailScreen(doc: legalDocs[i])),
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
