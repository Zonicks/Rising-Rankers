import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/skeleton.dart';
import '../../ui/widgets.dart';
import '../legal/legal_copy.dart';
import '../legal/legal_detail_screen.dart';
import '../legal/legal_screen.dart';

const supportCategories = [
  'Payment',
  'Wallet',
  'Withdrawal',
  'Question error',
  'Test issue',
  'Account',
  'Other',
];

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  final _subject = TextEditingController();
  final _message = TextEditingController();
  String _category = 'Other';
  List<dynamic> _tickets = [];
  bool _loading = true;
  bool _busy = false;
  String? _error;
  String? _msg;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _subject.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await widget.api.request(
        'GET',
        '/api/v1/support/tickets/me',
        auth: true,
      );
      if (!mounted) return;
      setState(() {
        _tickets = res['data'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message;
      });
    }
  }

  Future<void> _submit() async {
    if (_subject.text.trim().isEmpty || _message.text.trim().isEmpty) {
      setState(() => _error = 'Subject and message are required');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _msg = null;
    });
    try {
      await widget.api.request(
        'POST',
        '/api/v1/support/tickets',
        auth: true,
        body: {
          'category': _category,
          'subject': _subject.text.trim(),
          'message': _message.text.trim(),
        },
      );
      _subject.clear();
      _message.clear();
      setState(() => _msg = 'Ticket sent. We’ll update the status here.');
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  StatusTone _tone(String status) {
    return switch (status) {
      'OPEN' => StatusTone.accent,
      'IN_PROGRESS' => StatusTone.accent,
      'RESOLVED' => StatusTone.success,
      'CLOSED' => StatusTone.neutral,
      _ => StatusTone.neutral,
    };
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final faq = legalDocs.where((d) => d.faq != null).first;

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
                      icon: const Icon(
                        Icons.arrow_back_ios_new_rounded,
                        size: 18,
                      ),
                    ),
                    Text('Support', style: t.titleLarge),
                  ],
                ),
              ),
              Expanded(
                child: FadeRise(
                  child: _loading
                      ? const SupportSkeleton()
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                          children: [
                            const ScreenHeader(
                              overline: 'Help',
                              title: 'Support',
                              subtitle:
                                  'Report a payment, wallet, test, or account issue.',
                            ),
                            const SizedBox(height: 8),
                            TextButton(
                              onPressed: () => pushFade(
                                context,
                                LegalDetailScreen(doc: faq),
                              ),
                              child: const Align(
                                alignment: Alignment.centerLeft,
                                child: Text('Read the FAQ'),
                              ),
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 8),
                              InlineError(_error!),
                            ],
                            if (_msg != null) ...[
                              const SizedBox(height: 12),
                              Text(
                                _msg!,
                                style: t.bodyMedium?.copyWith(
                                  color: AppColors.success,
                                ),
                              ),
                            ],
                            const SizedBox(height: 20),
                            const FieldLabel('Category'),
                            DropdownButtonFormField<String>(
                              initialValue: _category,
                              isExpanded: true,
                              items: [
                                for (final c in supportCategories)
                                  DropdownMenuItem(value: c, child: Text(c)),
                              ],
                              onChanged: (v) =>
                                  setState(() => _category = v ?? 'Other'),
                            ),
                            const SizedBox(height: 16),
                            const FieldLabel('Subject'),
                            TextField(
                              controller: _subject,
                              maxLength: 160,
                              decoration: const InputDecoration(
                                counterText: '',
                              ),
                            ),
                            const SizedBox(height: 16),
                            const FieldLabel('Message'),
                            TextField(
                              controller: _message,
                              maxLength: 2000,
                              minLines: 4,
                              maxLines: 8,
                              decoration: const InputDecoration(
                                counterText: '',
                              ),
                            ),
                            const SizedBox(height: 20),
                            PrimaryButton(
                              label: 'Send ticket',
                              busy: _busy,
                              onPressed: _submit,
                            ),
                            const SizedBox(height: 32),
                            Text('YOUR TICKETS', style: t.labelMedium),
                            const SizedBox(height: 8),
                            if (_tickets.isEmpty)
                              const EmptyState(
                                title: 'No tickets yet',
                                body:
                                    'Send a message above and it will show up here with status.',
                              )
                            else
                              for (final raw in _tickets)
                                _TicketTile(
                                  ticket: raw as Map<String, dynamic>,
                                  tone: _tone,
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

class _TicketTile extends StatelessWidget {
  const _TicketTile({required this.ticket, required this.tone});

  final Map<String, dynamic> ticket;
  final StatusTone Function(String status) tone;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final status = ticket['status']?.toString() ?? 'OPEN';
    final created = ticket['createdAt']?.toString();
    DateTime? when;
    if (created != null) when = DateTime.tryParse(created);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  ticket['subject']?.toString() ?? 'Ticket',
                  style: t.titleMedium,
                ),
              ),
              StatusChip(status.replaceAll('_', ' '), tone: tone(status)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            [
              ticket['category']?.toString() ?? '',
              if (when != null) '${when.day}/${when.month}/${when.year}',
            ].where((s) => s.isNotEmpty).join(' · '),
            style: t.bodySmall,
          ),
          const SizedBox(height: 8),
          Text(
            ticket['message']?.toString() ?? '',
            style: t.bodyMedium?.copyWith(height: 1.45),
          ),
          const Divider(height: 28),
        ],
      ),
    );
  }
}
