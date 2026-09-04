import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../ui/skeleton.dart';
import '../../ui/widgets.dart';

class McqScreen extends StatefulWidget {
  const McqScreen({
    super.key,
    required this.api,
    this.chapterId,
    this.subjectId,
  });

  final ApiClient api;
  final String? chapterId;
  final String? subjectId;

  @override
  State<McqScreen> createState() => _McqScreenState();
}

class _McqScreenState extends State<McqScreen> {
  Map<String, dynamic>? _mcq;
  Map<String, dynamic>? _result;
  String? _selected;
  bool _busy = false;
  String? _error;
  String? _errorCode;
  double? _unlockPrice;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
      _errorCode = null;
      _result = null;
      _selected = null;
      _unlockPrice = null;
    });
    try {
      final p = <String, String>{};
      if (widget.chapterId != null) p['chapterId'] = widget.chapterId!;
      if (widget.subjectId != null) p['subjectId'] = widget.subjectId!;
      final qs = p.isEmpty
          ? ''
          : '?${p.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&')}';
      final res = await widget.api.request(
        'GET',
        '/api/v1/mcqs/next$qs',
        auth: true,
      );
      final data = res['data'] as Map<String, dynamic>;
      setState(() => _mcq = data['mcq'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      setState(() {
        _mcq = null;
        _error = e.message;
        _errorCode = e.code;
        if (e.code == 'QUOTA_EXCEEDED' && e.details is Map) {
          _unlockPrice = (e.details['unlockPrice'] as num?)?.toDouble();
        }
      });
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _answer(String option) async {
    if (_mcq == null || _result != null) return;
    setState(() {
      _busy = true;
      _selected = option;
    });
    try {
      final res = await widget.api.request(
        'POST',
        '/api/v1/mcqs/${_mcq!['id']}/answer',
        auth: true,
        body: {'selectedOption': option},
      );
      setState(() => _result = res['data'] as Map<String, dynamic>);
      if (mounted)
        showRewardsToast(context, _result?['rewards'] as Map<String, dynamic>?);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      setState(() => _busy = false);
    }
  }

  Color _optionBg(String o) {
    if (_result == null) return AppColors.bgElevated;
    final correct = _result!['correctOption']?.toString();
    if (o == correct) return AppColors.successSoft;
    if (o == _selected && _result!['isCorrect'] != true)
      return AppColors.dangerSoft;
    return AppColors.bgElevated;
  }

  Color _optionBorder(String o) {
    if (_result == null) return AppColors.line;
    final correct = _result!['correctOption']?.toString();
    if (o == correct) return AppColors.success;
    if (o == _selected && _result!['isCorrect'] != true)
      return AppColors.danger;
    return AppColors.line;
  }

  Future<void> _unlock() async {
    setState(() => _busy = true);
    try {
      await widget.api.request('POST', '/api/v1/mcqs/unlock', auth: true);
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final options = ['A', 'B', 'C', 'D'];
    final t = Theme.of(context).textTheme;

    return SafeArea(
      child: FadeRise(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          children: [
            if (Navigator.of(context).canPop())
              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ),
            const ScreenHeader(
              overline: 'Practice',
              title: 'MCQ practice',
              subtitle: 'One question. Clear feedback.',
            ),
            const SizedBox(height: 28),
            if (_mcq == null && _error == null)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: McqSkeleton(),
              ),
            if (_error != null && _mcq == null) ...[
              InlineError(_error!),
              if (_unlockPrice != null) ...[
                const SizedBox(height: 16),
                PrimaryButton(
                  label: 'Unlock more · ₹$_unlockPrice',
                  busy: _busy,
                  onPressed: _unlock,
                ),
              ],
              if (_errorCode == 'FORBIDDEN') ...[
                const SizedBox(height: 16),
                SecondaryButton(
                  label: 'Find this book in Search',
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ],
            if (_mcq != null) ...[
              Text(
                _mcq!['question']?.toString() ?? '',
                style: t.headlineSmall?.copyWith(height: 1.4),
              ),
              const SizedBox(height: 24),
              ...options.map((o) {
                final text = _mcq!['option$o']?.toString() ?? '';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    curve: Curves.easeOut,
                    decoration: BoxDecoration(
                      color: _optionBg(o),
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      border: Border.all(color: _optionBorder(o)),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      onTap: _busy || _result != null ? null : () => _answer(o),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 16,
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              o,
                              style: t.titleMedium?.copyWith(
                                color: AppColors.accent,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(child: Text(text, style: t.bodyLarge)),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }),
              if (_result != null) ...[
                const SizedBox(height: 12),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _result!['isCorrect'] == true
                        ? AppColors.successSoft
                        : AppColors.dangerSoft,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _result!['isCorrect'] == true
                            ? 'Correct'
                            : 'Incorrect · Answer ${_result!['correctOption']}',
                        style: t.titleMedium?.copyWith(
                          color: _result!['isCorrect'] == true
                              ? AppColors.success
                              : AppColors.danger,
                        ),
                      ),
                      if (_result!['explanation'] != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          _result!['explanation'].toString(),
                          style: t.bodyMedium?.copyWith(
                            color: AppColors.inkSoft,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                PrimaryButton(
                  label: 'Next question',
                  busy: _busy,
                  onPressed: _load,
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
