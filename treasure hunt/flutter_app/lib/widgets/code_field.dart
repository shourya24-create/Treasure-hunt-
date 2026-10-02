/// widgets/code_field.dart — Large mono input. Gold when focused.
///
/// Used where the field is the screen's single focus: the gate code, the
/// login, and typed confirmations. On failure it flashes red once.
library;

import 'package:flutter/material.dart';

import '../theme.dart';
import 'status_dot.dart';

class CodeField extends StatelessWidget {
  const CodeField({
    super.key,
    required this.controller,
    this.hint = '',
    this.label,
    this.failed = false,
    this.obscure = false,
    this.autofocus = false,
    this.enabled = true,
    this.large = true,
    this.onSubmitted,
    this.onChanged,
  });

  final TextEditingController controller;
  final String hint;
  final String? label;

  /// The last attempt was rejected: the border turns red.
  final bool failed;
  final bool obscure;
  final bool autofocus;
  final bool enabled;
  final bool large;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;

  OutlineInputBorder _border(Color color) => OutlineInputBorder(
        borderRadius: const BorderRadius.all(Radius.circular(2)),
        borderSide: BorderSide(color: color, width: 1.5),
      );

  Widget _field(Color? failColor) => TextField(
        controller: controller,
        autofocus: autofocus,
        enabled: enabled,
        obscureText: obscure,
        autocorrect: false,
        enableSuggestions: false,
        textCapitalization: TextCapitalization.characters,
        textAlign: large ? TextAlign.center : TextAlign.start,
        style: EchoText.mono(
          size: large ? 24 : 16,
          spacing: large ? 6 : 2,
          color: EchoColors.textHeadline,
        ),
        decoration: InputDecoration(
          hintText: hint,
          labelText: label,
          contentPadding: EdgeInsets.symmetric(
            horizontal: 16,
            vertical: large ? 20 : 16,
          ),
          enabledBorder: failColor == null ? null : _border(failColor),
          focusedBorder: failColor == null ? null : _border(failColor),
        ),
        onSubmitted: onSubmitted,
        onChanged: onChanged,
      );

  @override
  Widget build(BuildContext context) => failed
      ? FailureFlash(builder: (_, color) => _field(color))
      : _field(null);
}
