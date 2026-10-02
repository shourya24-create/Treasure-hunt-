/// widgets/fragment_tracker.dart — 8 slots, numbered by order of completion.
///
/// Never by checkpoint ID, so the tracker cannot reveal the route (UI.md §3.3).
/// Solved = filled dim green, static · current = bright green outline,
/// pulsing · ahead = hairline outline, muted number.
library;

import 'package:flutter/material.dart';

import '../theme.dart';
import 'status_dot.dart';

class FragmentTracker extends StatelessWidget {
  const FragmentTracker({
    super.key,
    required this.done,
    this.total = 8,
    this.showCurrent = true,
  });

  /// Checkpoints completed so far, CP1 included.
  final int done;
  final int total;

  /// False once nothing is in progress (returning to base, final, finished).
  final bool showCurrent;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          for (var i = 0; i < total; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(child: _slot(i)),
          ],
        ],
      );

  Widget _slot(int i) {
    final number = '${i + 1}';
    if (i < done) {
      return _box(
        fill: EchoColors.signalGreenDim,
        border: EchoColors.signalGreen,
        child: Text(number, style: EchoText.mono(size: 12, color: EchoColors.textPrimary)),
      );
    }
    if (i == done && showCurrent) {
      return Pulse(
        child: _box(
          border: EchoColors.signalGreenBright,
          width: 1.5,
          child: Text(number, style: EchoText.mono(size: 12, color: EchoColors.textHeadline)),
        ),
      );
    }
    return _box(
      border: EchoColors.hairline,
      child: Text(number, style: EchoText.mono(size: 12, color: EchoColors.textMuted)),
    );
  }

  Widget _box({
    required Color border,
    required Widget child,
    Color? fill,
    double width = 1,
  }) =>
      Container(
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: fill,
          border: Border.all(color: border, width: width),
        ),
        child: child,
      );
}
