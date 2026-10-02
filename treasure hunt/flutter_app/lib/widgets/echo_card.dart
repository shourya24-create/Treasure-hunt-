/// widgets/echo_card.dart — Card / panel: bg-surface with a hairline border.
library;

import 'package:flutter/material.dart';

import '../theme.dart';

class EchoCard extends StatelessWidget {
  const EchoCard({
    super.key,
    required this.child,
    this.raised = false,
    this.borderColor = EchoColors.hairline,
    this.padding = const EdgeInsets.all(20),
    this.onTap,
  });

  final Widget child;

  /// Steps the surface up: active cards, selected rows, modals.
  final bool raised;

  /// Brightens toward signal-green for a selected row; red or amber only
  /// when the card is reporting a failure or a measurement.
  final Color borderColor;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: raised ? EchoColors.bgSurfaceRaised : EchoColors.bgSurface,
        shape: RoundedRectangleBorder(
          borderRadius: const BorderRadius.all(Radius.circular(2)),
          side: BorderSide(color: borderColor),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          hoverColor: EchoColors.bgSurfaceRaised,
          splashColor: EchoColors.signalGreen.withValues(alpha: 0.12),
          highlightColor: Colors.transparent,
          child: Padding(padding: padding, child: child),
        ),
      );
}
