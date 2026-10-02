/// widgets/team_chip.dart — Mono "T5" chip, coloured by team status.
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

  @override
  Widget build(BuildContext context) {
    final border = switch (status) {
      EchoStatus.live => EchoColors.signalGreen,
      EchoStatus.done => EchoColors.signalGreenDim,
      EchoStatus.failed => EchoColors.dangerRed,
      EchoStatus.warning => EchoColors.warningAmber,
      EchoStatus.idle => EchoColors.hairline,
    };

    return Material(
      color: EchoColors.bgSurface,
      shape: RoundedRectangleBorder(
        borderRadius: const BorderRadius.all(Radius.circular(2)),
        side: BorderSide(color: border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        hoverColor: EchoColors.bgSurfaceRaised,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              StatusDot(status, size: 7),
              const SizedBox(width: 6),
              Text(
                teamId,
                style: EchoText.mono(
                  size: 13,
                  color: status == EchoStatus.idle
                      ? EchoColors.textSecondary
                      : EchoColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
