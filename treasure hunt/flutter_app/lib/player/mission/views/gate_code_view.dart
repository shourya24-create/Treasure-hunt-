/// GateCodeView — the briefing is over; the team types the gate code a
/// volunteer handed them for the solved paper (GAMEPLAY.md §4.2).
///
/// Focus mode: the nav is hidden and the code field is the one gold element.
/// A wrong code flashes red and says "INVALID CODE". There is no penalty.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/team_provider.dart';
import '../../../core/services/team_service.dart' show readableError;
import '../../../theme.dart';
import '../../../widgets/code_field.dart';
import '../../../widgets/echo_button.dart';
import '../../../widgets/echo_scaffold.dart';
import '../../../widgets/section_label.dart';
import '../../../widgets/status_dot.dart';

class GateCodeView extends StatefulWidget {
  const GateCodeView({super.key});

  @override
  State<GateCodeView> createState() => _GateCodeViewState();
}

class _GateCodeViewState extends State<GateCodeView> {
  final _codeCtrl = TextEditingController();
  bool _sending = false;
  String? _error;

  /// Bumped on every failure so the red flash plays again.
  int _attempt = 0;

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final code = _codeCtrl.text.trim();
    if (code.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final accepted = await context.read<TeamProvider>().enterGateCode(code);
      if (!mounted) return;
      // On success the view stream moves the app on by itself.
      if (!accepted) _fail('Invalid code');
    } catch (e) {
      if (mounted) _fail(readableError(e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _fail(String message) => setState(() {
        _error = message;
        _attempt++;
      });

  @override
  Widget build(BuildContext context) => EchoPage(
        children: [
          const SizedBox(height: 32),
          const SectionLabel('Checkpoint 01'),
          const SizedBox(height: 16),
          Text('ENTER ACCESS CODE', style: EchoText.headline(size: 36)),
          const SizedBox(height: 12),
          Text(
            'Solve the paper. Show it to a volunteer and they will hand you '
            'your code.',
            style: EchoText.body(color: EchoColors.textSecondary),
          ),
          const SizedBox(height: 32),
          CodeField(
            key: ValueKey(_attempt),
            controller: _codeCtrl,
            hint: 'CODE',
            autofocus: true,
            failed: _error != null,
            enabled: !_sending,
            onSubmitted: (_) => _verify(),
          ),
          const SizedBox(height: 16),
          if (_error != null) ...[
            StatusTag(_error!, status: EchoStatus.failed),
            const SizedBox(height: 16),
          ],
          if (_sending)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: DecryptingText(label: 'VERIFYING'),
            )
          else
            EchoButton.primary(label: 'Verify', onPressed: _verify),
        ],
      );
}
