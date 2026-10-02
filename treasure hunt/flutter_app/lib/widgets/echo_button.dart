/// widgets/echo_button.dart — The three button roles of DESIGN_SYSTEM.md §5.
library;

import 'package:flutter/material.dart';

import '../theme.dart';

enum _Role { primary, destructive, ghost }

class EchoButton extends StatelessWidget {
  /// Primary action: Scan, Verify, Start.
  const EchoButton.primary({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  }) : _role = _Role.primary;

  /// Destructive action: Destroy Echo, End game, Release phone.
  const EchoButton.destructive({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  }) : _role = _Role.destructive;

  /// Secondary / ghost.
  const EchoButton.ghost({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  }) : _role = _Role.ghost;

  final String label;

  /// Null disables the button.
  final VoidCallback? onPressed;
  final IconData? icon;
  final _Role _role;

  @override
  Widget build(BuildContext context) {
    final text = Text(label.toUpperCase(), textAlign: TextAlign.center);
    final child = icon == null
        ? text
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 20),
              const SizedBox(width: 10),
              Flexible(child: text),
            ],
          );

    return switch (_role) {
      _Role.primary => ElevatedButton(
          style: EchoButtonStyles.primary,
          onPressed: onPressed,
          child: child,
        ),
      _Role.destructive => ElevatedButton(
          style: EchoButtonStyles.destructive,
          onPressed: onPressed,
          child: child,
        ),
      _Role.ghost => OutlinedButton(
          style: EchoButtonStyles.ghost,
          onPressed: onPressed,
          child: child,
        ),
    };
  }
}
