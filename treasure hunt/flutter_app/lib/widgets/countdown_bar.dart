/// widgets/countdown_bar.dart — Mono time + amber bar to the 2-hour mark.
///
/// Amber because it is a measurement. Under 10 minutes it turns danger-red.
/// Reads the shared game clock, so every countdown on screen moves together.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/models/game.dart';
import '../core/providers/game_clock_provider.dart';
import '../theme.dart';

class CountdownBar extends StatelessWidget {
  const CountdownBar({super.key, required this.game, this.trailing});

  final GameState game;

  /// Shown to the right of the bar (e.g. "3 / 8").
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final now = context.watch<GameClockProvider>().now;
    final remaining = game.remaining(now);
    final closed = game.closed(now);
    final low = game.started && remaining <= GameState.lowTime;
    final color = low || closed ? EchoColors.dangerRedBright : EchoColors.warningAmber;
    final fraction = closed
        ? 0.0
        : remaining.inSeconds / GameState.duration.inSeconds;

    return Row(
      children: [
        Text(
          game.started ? formatDuration(closed ? Duration.zero : remaining) : '--:--:--',
          style: EchoText.mono(
            size: 16,
            weight: FontWeight.w700,
            spacing: 1.5,
            color: game.started ? color : EchoColors.textMuted,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Container(
            height: 6,
            decoration: BoxDecoration(border: Border.all(color: EchoColors.hairline)),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: game.started ? fraction.clamp(0.0, 1.0).toDouble() : 0.0,
              child: ColoredBox(
                color: low ? EchoColors.dangerRed : EchoColors.warningAmber,
              ),
            ),
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 12),
          trailing!,
        ],
      ],
    );
  }
}
