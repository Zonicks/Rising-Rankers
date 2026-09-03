import 'package:flutter/material.dart';
import '../../ui/widgets.dart';
import 'legal_copy.dart';

class LegalDetailScreen extends StatelessWidget {
  const LegalDetailScreen({super.key, required this.doc});

  final LegalDoc doc;

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
                    Expanded(child: Text(doc.title, style: t.titleLarge)),
                  ],
                ),
              ),
              Expanded(
                child: FadeRise(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                    children: [
                      if (doc.faq != null)
                        ...doc.faq!.map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 22),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.question, style: t.headlineSmall),
                                const SizedBox(height: 8),
                                Text(item.answer, style: t.bodyMedium?.copyWith(height: 1.5)),
                              ],
                            ),
                          ),
                        )
                      else
                        ...doc.paragraphs.map(
                          (p) => Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: Text(p, style: t.bodyMedium?.copyWith(height: 1.5)),
                          ),
                        ),
                      const SizedBox(height: 8),
                      Text(
                        'Last updated $legalUpdated. Have a lawyer review this pack before a public paid launch.',
                        style: t.bodySmall,
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
