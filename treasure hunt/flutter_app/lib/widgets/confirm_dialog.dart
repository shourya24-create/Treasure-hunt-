/// widgets/confirm_dialog.dart — Title, consequence sentence, and a confirm
/// button styled by what the action does.
///
/// Every admin action that changes points, progress or the route goes
/// through one of these (UI.md §4.3). A dialog counts as its own screen.
library;

import 'package:flutter/material.dart';

import '../theme.dart';
import 'code_field.dart';
import 'echo_button.dart';

class ConfirmDialog extends StatelessWidget {
  const ConfirmDialog({
    super.key,
    required this.title,
    required this.consequence,
    required this.confirmLabel,
    this.destructive = false,
  });

  final String title;

  /// One sentence saying what will happen.
  final String consequence;
  final String confirmLabel;
  final bool destructive;

  /// Returns true if the user confirmed.
  static Future<bool> show(
    BuildContext context, {
    required String title,
    required String consequence,
    required String confirmLabel,
    bool destructive = false,
  }) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => ConfirmDialog(
        title: title,
        consequence: consequence,
        confirmLabel: confirmLabel,
        destructive: destructive,
      ),
    );
    return ok ?? false;
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(title.toUpperCase()),
        content: Text(consequence),
        actions: [
          EchoButton.ghost(
            label: 'Cancel',
            onPressed: () => Navigator.of(context).pop(false),
          ),
          destructive
              ? EchoButton.destructive(
                  label: confirmLabel,
                  onPressed: () => Navigator.of(context).pop(true),
                )
              : EchoButton.primary(
                  label: confirmLabel,
                  onPressed: () => Navigator.of(context).pop(true),
                ),
        ],
      );
}

/// For the two actions that affect every team: the user must type a word.
class TypedConfirmDialog extends StatefulWidget {
  const TypedConfirmDialog({
    super.key,
    required this.title,
    required this.consequence,
    required this.word,
    this.destructive = false,
  });

  final String title;
  final String consequence;

  /// What must be typed, e.g. "END".
  final String word;
  final bool destructive;

  static Future<bool> show(
    BuildContext context, {
    required String title,
    required String consequence,
    required String word,
    bool destructive = false,
  }) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => TypedConfirmDialog(
        title: title,
        consequence: consequence,
        word: word,
        destructive: destructive,
      ),
    );
    return ok ?? false;
  }

  @override
  State<TypedConfirmDialog> createState() => _TypedConfirmDialogState();
}

class _TypedConfirmDialogState extends State<TypedConfirmDialog> {
  final _ctrl = TextEditingController();

  bool get _matches => _ctrl.text.trim().toUpperCase() == widget.word.toUpperCase();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _confirm() {
    if (_matches) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.title.toUpperCase()),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.consequence),
            const SizedBox(height: 20),
            Text('TYPE ${widget.word.toUpperCase()} TO CONFIRM', style: EchoText.label()),
            const SizedBox(height: 8),
            CodeField(
              controller: _ctrl,
              autofocus: true,
              large: false,
              hint: widget.word.toUpperCase(),
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _confirm(),
            ),
          ],
        ),
        actions: [
          EchoButton.ghost(
            label: 'Cancel',
            onPressed: () => Navigator.of(context).pop(false),
          ),
          widget.destructive
              ? EchoButton.destructive(
                  label: widget.title,
                  onPressed: _matches ? _confirm : null,
                )
              : EchoButton.primary(
                  label: widget.title,
                  onPressed: _matches ? _confirm : null,
                ),
        ],
      );
}

/// A short notice at the bottom of the screen. Red-bordered when it reports a failure.
void showEchoNotice(
  BuildContext context,
  String message, {
  bool failed = false,
  SnackBarAction? action,
  Duration duration = const Duration(seconds: 4),
}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message.toUpperCase()),
        duration: duration,
        action: action,
        shape: RoundedRectangleBorder(
          borderRadius: const BorderRadius.all(Radius.circular(2)),
          side: BorderSide(
            color: failed ? EchoColors.dangerRed : EchoColors.signalGreen,
          ),
        ),
      ),
    );
}
