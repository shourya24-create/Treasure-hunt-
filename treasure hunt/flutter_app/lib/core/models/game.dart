/// core/models/game.dart — Event-wide state at /game/state.
///
/// Dart mirror of GameState in functions/src/schema.ts. Any signed-in phone
/// may read it: it holds the clock and the headset queue, nothing secret.
library;

import 'package:cloud_firestore/cloud_firestore.dart';

class GameState {
  const GameState({
    required this.ended,
    required this.paused,
    required this.finalQueue,
    this.startedAt,
    this.inHeadset,
  });

  static const initial = GameState(ended: false, paused: false, finalQueue: []);

  /// The event lasts 2 hours from "Start game".
  static const duration = Duration(hours: 2);

  /// Under this much time left, the countdown turns red.
  static const lowTime = Duration(minutes: 10);

  final DateTime? startedAt;

  /// Admin pressed "End game".
  final bool ended;
  final bool paused;

  /// Teams at the final that have not decided yet, in arrival order.
  final List<String> finalQueue;

  /// The one team whose member is in the headset right now.
  final String? inHeadset;

  factory GameState.fromMap(Map<String, dynamic>? d) => d == null
      ? initial
      : GameState(
          startedAt: (d['startedAt'] as Timestamp?)?.toDate(),
          ended: d['ended'] as bool? ?? false,
          paused: d['paused'] as bool? ?? false,
          finalQueue: List<String>.from(d['finalQueue'] as List? ?? const []),
          inHeadset: d['inHeadset'] as String?,
        );

  bool get started => startedAt != null;

  /// Time left on the 2-hour clock; the full 2 hours before the game starts.
  Duration remaining(DateTime now) {
    final start = startedAt;
    if (start == null) return duration;
    final left = duration - now.difference(start);
    return left.isNegative ? Duration.zero : left;
  }

  /// Time since "Start game".
  Duration elapsed(DateTime now) {
    final start = startedAt;
    if (start == null) return Duration.zero;
    final passed = now.difference(start);
    return passed.isNegative ? Duration.zero : passed;
  }

  /// The campus game is over: ended by the admin, or the 2 hours ran out.
  bool closed(DateTime now) => ended || (started && remaining(now) == Duration.zero);
}

String _two(int n) => n.toString().padLeft(2, '0');

/// 01:12:44
String formatDuration(Duration d) =>
    '${_two(d.inHours)}:${_two(d.inMinutes % 60)}:${_two(d.inSeconds % 60)}';

/// 14:32:05 (local time)
String formatClock(DateTime t) => '${_two(t.hour)}:${_two(t.minute)}:${_two(t.second)}';

/// 14:32
String formatShortClock(DateTime t) => '${_two(t.hour)}:${_two(t.minute)}';

/// "45S", "12M", "1H 05M" — how long ago, or "—" if never.
String formatAgo(DateTime? t, DateTime now) {
  if (t == null) return '—';
  final d = now.difference(t);
  if (d.inSeconds < 60) return '${d.isNegative ? 0 : d.inSeconds}S';
  if (d.inMinutes < 60) return '${d.inMinutes}M';
  return '${d.inHours}H ${_two(d.inMinutes % 60)}M';
}
