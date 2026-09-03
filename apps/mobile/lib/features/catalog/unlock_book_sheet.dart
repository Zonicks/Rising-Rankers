import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';
import '../wallet/wallet_screen.dart';

Future<bool> showUnlockBookSheet(BuildContext context, ApiClient api, String bookId) async {
  final ok = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.bgElevated,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (ctx) => _UnlockBookSheet(api: api, bookId: bookId),
  );
  return ok == true;
}

class _UnlockBookSheet extends StatefulWidget {
  const _UnlockBookSheet({required this.api, required this.bookId});

  final ApiClient api;
  final String bookId;

  @override
  State<_UnlockBookSheet> createState() => _UnlockBookSheetState();
}

class _UnlockBookSheetState extends State<_UnlockBookSheet> {
  Map<String, dynamic>? _book;
  Map<String, dynamic>? _wallet;
  String? _error;
  bool _busy = false;
  bool _insufficient = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final book = await widget.api.request('GET', '/api/v1/catalog/books/${widget.bookId}', auth: true);
      final wallet = await widget.api.request('GET', '/api/v1/wallet', auth: true);
      setState(() {
        _book = book['data'] as Map<String, dynamic>;
        _wallet = wallet['data'] as Map<String, dynamic>;
        _error = null;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  double _spendable() {
    final d = double.tryParse('${_wallet?['deposited'] ?? 0}') ?? 0;
    final p = double.tryParse('${_wallet?['promo'] ?? 0}') ?? 0;
    return d + p;
  }

  Future<void> _pay() async {
    setState(() {
      _busy = true;
      _error = null;
      _insufficient = false;
    });
    try {
      await widget.api.request('POST', '/api/v1/catalog/books/${widget.bookId}/unlock', auth: true);
      if (!mounted) return;
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      setState(() {
        _busy = false;
        _error = e.message;
        _insufficient = e.code == 'WALLET_INSUFFICIENT';
      });
    }
  }

  void _openWallet() {
    final nav = Navigator.of(context);
    nav.pop(false);
    nav.push(
      MaterialPageRoute(
        builder: (_) => Scaffold(body: AppAtmosphere(child: WalletScreen(api: widget.api))),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final book = _book;
    final price = book == null ? 0 : asInt(book['price']);
    final granted = book?['granted'] == true;
    final free = granted || price == 0;
    final inProgram = book?['inProgram'] == true;
    final program = '${book?['program'] ?? ''}';
    final author = '${book?['authorName'] ?? ''}';

    return Padding(
      padding: EdgeInsets.fromLTRB(24, 20, 24, 24 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(free ? 'Add to study set' : 'Confirm add-on', style: t.labelMedium),
          const SizedBox(height: 8),
          if (book == null && _error == null)
            const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator()))
          else if (book != null) ...[
            Text('${book['title']}', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
            if (author.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(author, style: t.bodyMedium),
            ],
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Chip(label: Text(inProgram ? 'In your syllabus' : '$program add-on')),
                Text(
                  free ? 'FREE' : '₹$price',
                  style: t.titleMedium?.copyWith(
                    color: free ? AppColors.success : AppColors.ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            if (_wallet != null) ...[
              const SizedBox(height: 12),
              Text(
                'Wallet spendable ₹${_spendable().round()}${price > 0 ? ' · deposited first, then promo.' : ''}',
                style: t.bodyMedium,
              ),
            ],
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: t.bodyMedium?.copyWith(color: AppColors.danger)),
            if (_book == null)
              TextButton(onPressed: _load, child: const Text('Try again')),
          ],
          const SizedBox(height: 20),
          if (_insufficient)
            PrimaryButton(label: 'Open wallet', onPressed: _openWallet)
          else
            PrimaryButton(
              label: free ? 'Add to study set' : 'Pay ₹$price & add',
              busy: _busy,
              onPressed: _busy || book == null ? null : _pay,
            ),
          const SizedBox(height: 8),
          SecondaryButton(label: 'Cancel', onPressed: () => Navigator.pop(context, false)),
        ],
      ),
    );
  }
}
