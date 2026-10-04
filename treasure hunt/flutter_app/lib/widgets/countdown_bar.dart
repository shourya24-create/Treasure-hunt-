/// widgets/countdown_bar.dart — Mono time + amber bar to the 2-hour mark.
///
/// Amber because it is a measurement. In the last 10 minutes, and once the
/// campus game has closed, it is a failure: one flash, then static danger-red.
/// Reads the shared game clock, so every countdown on screen moves together.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/models/game.dart';
import '../core/providers/game_clock_provider.dart';
import '../theme.dart';
import 'status_dot.dart';

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
    final alarm = game.started && (closed || remaining <= GameState.lowTime);
    final time = game.started
        ? formatDuration(closed ? Duration.zero : remaining)
        : '--:--:--';
    final fraction = game.started && !closed
        ? (remaining.inSeconds / GameState.duration.inSeconds).clamp(0.0, 1.0).toDouble()
        : 0.0;

    if (!alarm) {
      return _row(
        time: Text(
          time,
          style: _digits(game.started ? EchoColors.warningAmber : EchoColors.textMuted),
        ),
        fill: EchoColors.warningAmber,
        fraction: fraction,
      );
    }

    // Keyed by which failure it is, so the flash plays once when the last ten
    // minutes begin and once more when the clock runs out.
    return FailureFlash(
      key: ValueKey(closed),
      builder: (context, red) => _row(
        // Danger-red digits are too dim to read on the dark surface outdoors,
        // so the red is a block and the digits on it stay text-headline.
        time: Container(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          decoration: BoxDecoration(
            color: red,
            borderRadius: const BorderRadius.all(Radius.circular(2)),
          ),
          child: Text(time, style: _digits(EchoColors.textHeadline)),
        ),
        fill: red,
        fraction: fraction,
      ),
    );
  }

  TextStyle _digits(Color color) =>
      EchoText.mono(size: 16, weight: FontWeight.w700, spacing: 1.5, color: color);

  Widget _row({required Widget time, required Color fill, required double fraction}) => Row(
        children: [
          time,
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              height: 6,
              decoration: BoxDecoration(border: Border.all(color: EchoColors.hairline)),
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: fraction,
                child: ColoredBox(color: fill),
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
