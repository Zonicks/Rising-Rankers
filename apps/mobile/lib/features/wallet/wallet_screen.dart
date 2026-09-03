import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/widgets.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  Map<String, dynamic>? _balances;
  List<dynamic> _ledger = [];
  String? _error;
  String? _msg;
  bool _busy = false;
  final _amount = TextEditingController(text: '100');

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final bal = await widget.api.request('GET', '/api/v1/wallet', auth: true);
      final led = await widget.api.request('GET', '/api/v1/wallet/ledger', auth: true);
      setState(() {
        _balances = bal['data'] as Map<String, dynamic>;
        _ledger = led['data'] as List<dynamic>? ?? [];
        _error = null;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  Future<void> _deposit() async {
    final amount = double.tryParse(_amount.text.trim());
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Enter a valid amount');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _msg = null;
    });
    try {
      final payment = await widget.api.request(
        'POST',
        '/api/v1/wallet/deposit',
        auth: true,
        body: {'amount': amount},
      );
      final paymentId = (payment['data'] as Map<String, dynamic>)['paymentId'];
      await widget.api.request(
        'POST',
        '/api/v1/payments/sandbox/confirm',
        auth: true,
        body: {'paymentId': paymentId, 'status': 'SUCCESSFUL'},
      );
      setState(() => _msg = 'Sandbox deposit of ₹$amount succeeded');
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;

    return SafeArea(
      child: FadeRise(
        child: RefreshIndicator(
          onRefresh: _load,
          color: AppColors.accent,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 120),
            children: [
              const ScreenHeader(
                overline: 'Money',
                title: 'Wallet',
                subtitle: 'Awards you can withdraw. Sandbox deposits for testing.',
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                InlineError(_error!),
              ],
              if (_msg != null) ...[
                const SizedBox(height: 12),
                Text(_msg!, style: t.bodyMedium?.copyWith(color: AppColors.success)),
              ],
              const SizedBox(height: 22),
              WalletHero(
                award: _balances?['award'],
                deposited: _balances?['deposited'],
                promo: _balances?['promo'],
              ),
              const SizedBox(height: 28),
              Text('ADD FUNDS', style: t.labelMedium),
              const SizedBox(height: 12),
              MeritCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const FieldLabel('Sandbox amount (₹)'),
                    TextField(
                      controller: _amount,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                      decoration: const InputDecoration(hintText: '100'),
                    ),
                    const SizedBox(height: 16),
                    PrimaryButton(
                      label: 'Deposit (sandbox)',
                      busy: _busy,
                      onPressed: _deposit,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              Text('LEDGER', style: t.labelMedium),
              const SizedBox(height: 12),
              if (_ledger.isEmpty)
                MeritCard(
                  child: Text('No movements yet. Deposit to see the ledger come alive.', style: t.bodyMedium),
                )
              else
                MeritCard(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Column(
                    children: _ledger.asMap().entries.map((e) {
                      final r = e.value as Map<String, dynamic>;
                      final created = r['createdAt']?.toString() ?? '';
                      return HairlineListTile(
                        title: '${r['type']} · ₹${r['amount']}',
                        subtitle: created.length > 19 ? created.substring(0, 19) : created,
                        showDivider: e.key < _ledger.length - 1,
                      );
                    }).toList(),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
