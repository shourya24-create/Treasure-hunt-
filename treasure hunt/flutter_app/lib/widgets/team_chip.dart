/// widgets/team_chip.dart — Mono "T5" chip, coloured by team status.
///
/// Colour never carries the status alone (UI.md §8): every status but the
/// neutral one has its own icon as well.
library;

import 'package:flutter/material.dart';

import '../theme.dart';
import 'status_dot.dart';

class TeamChip extends StatelessWidget {
  const TeamChip(this.teamId, {super.key, this.status = EchoStatus.idle, this.onTap});

  final String teamId;

  /// live = playing · done = finished · failed = offline · warning = idle 15+ min.
  final EchoStatus status;
  final VoidCallback? onTap;

  static const _corners = RoundedRectangleBorder(
    borderRadius: BorderRadius.all(Radius.circular(2)),
  );

  /// Bright green and amber read well as the icon itself. Dim green and
  /// danger-red are too dark for that on the surface, so they fill a block
  /// and the icon sits on it.
  Widget _mark() => switch (status) {
        EchoStatus.live => Pulse(
            child: _icon(Icons.sensors, 'Playing', color: EchoColors.signalGreenBright),
          ),
        EchoStatus.done => _icon(
            Icons.check,
            'Finished',
            color: EchoColors.textPrimary,
            block: EchoColors.signalGreenDim,
            edge: EchoColors.signalGreen,
          ),
        EchoStatus.failed => FailureFlash(
            builder: (_, red) =>
                _icon(Icons.sensors_off, 'Offline', color: EchoColors.textHeadline, block: red),
          ),
        EchoStatus.warning =>
          _icon(Icons.hourglass_bottom, 'Idle', color: EchoColors.warningAmber),
        EchoStatus.idle => StatusDot(status, size: 7),
      };

  Widget _icon(IconData icon, String meaning, {required Color color, Color? block, Color? edge}) =>
      Container(
        width: 16,
        height: 16,
        alignment: Alignment.center,
        decoration: block == null
            ? null
            : BoxDecoration(
                color: block,
                border: Border.all(color: edge ?? block),
                borderRadius: const BorderRadius.all(Radius.circular(2)),
              ),
        child: Icon(icon, size: block == null ? 14 : 12, color: color, semanticLabel: meaning),
      );

  @override
  Widget build(BuildContext context) {
    final side = BorderSide(
      color: switch (status) {
        EchoStatus.live => EchoColors.signalGreen,
        EchoStatus.done => EchoColors.signalGreenDim,
        EchoStatus.failed => EchoColors.dangerRed,
        EchoStatus.warning => EchoColors.warningAmber,
        EchoStatus.idle => EchoColors.hairline,
      },
    );

    final content = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      // Shrinks rather than overflows inside a fixed-size parent.
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _mark(),
            const SizedBox(width: 6),
            Text(
              teamId,
              // Its own line box, as tall as the mark, so the chip is the
              // same height as a plain box and as a button.
              style: EchoText.mono(
                size: 13,
                color: status == EchoStatus.idle
                    ? EchoColors.textSecondary
                    : EchoColors.textPrimary,
              ).copyWith(height: 16 / 13, leadingDistribution: TextLeadingDistribution.even),
            ),
          ],
        ),
      ),
    );

    // Never stretched by a fixed-size parent such as a map marker: the
    // visible chip keeps its own size and the rest of the box is tap area.
    return Align(
      widthFactor: 1,
      heightFactor: 1,
      child: onTap == null
          ? Material(
              color: EchoColors.bgSurface,
              shape: _corners.copyWith(side: side),
              child: content,
            )
          : OutlinedButton(
              onPressed: onTap,
              style: ButtonStyle(
                backgroundColor: const WidgetStatePropertyAll(EchoColors.bgSurface),
                overlayColor: const WidgetStatePropertyAll(EchoColors.bgSurfaceRaised),
                shape: const WidgetStatePropertyAll(_corners),
                side: WidgetStatePropertyAll(side),
                padding: const WidgetStatePropertyAll(EdgeInsets.zero),
                minimumSize: const WidgetStatePropertyAll(Size.zero),
                // Pads the tap area out to 48 px without growing the chip
                // (UI.md §8). Standard density, or a laptop would shrink it.
                tapTargetSize: MaterialTapTargetSize.padded,
                visualDensity: VisualDensity.standard,
              ),
              child: content,
            ),
    );
  }
}
