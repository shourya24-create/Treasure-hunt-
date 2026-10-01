/// widgets/countdown_timer_widget.dart — Live countdown bar for the Scan screen.
///
/// Phase 3: reads startedAt + timeLimit - pausedDuration from TeamDoc,
/// refreshes every second via a local timer.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../models/team_doc.dart';
import '../theme.dart';

class CountdownTimerWidget extends StatefulWidget {
  const CountdownTimerWidget({super.key, required this.team});
  final TeamDoc team;

  @override
  State<CountdownTimerWidget> createState() => _CountdownTimerWidgetState();
}

class _CountdownTimerWidgetState extends State<CountdownTimerWidget> {
  late int _remaining;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _remaining = widget.team.remainingSeconds ?? widget.team.timeLimit;
    _startTimer();
  }

  @override
  void didUpdateWidget(CountdownTimerWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Firestore update may have changed startedAt/pausedDuration.
    _remaining = widget.team.remainingSeconds ?? _remaining;
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (_remaining > 0) _remaining--;
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pct = (_remaining / widget.team.timeLimit).clamp(0.0, 1.0);
    final critical = _remaining < 300; // < 5 minutes
    final color = critical ? EchoColors.error : EchoColors.cyan;

    return Container(
      color: EchoColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Text(
            _format(_remaining),
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: 16,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: LinearProgressIndicator(
                value: pct,
                backgroundColor: EchoColors.surfaceHigh,
                valueColor: AlwaysStoppedAnimation<Color>(color),
                minHeight: 6,
              ),
            ),
          ),
          const SizedBox(width: 12),
          if (critical)
            const Icon(Icons.warning_rounded, color: EchoColors.error, size: 18),
        ],
      ),
    );
  }

  String _format(int secs) {
    final h = secs ~/ 3600;
    final m = (secs % 3600) ~/ 60;
    final s = secs % 60;
    if (h > 0) {
      return '${h.toString().padLeft(2, "0")}:${m.toString().padLeft(2, "0")}:${s.toString().padLeft(2, "0")}';
    }
    return '${m.toString().padLeft(2, "0")}:${s.toString().padLeft(2, "0")}';
  }
}
