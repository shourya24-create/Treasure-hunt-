/// models/team_doc.dart — Dart mirror of the TeamDoc Firestore schema.
library;

import 'package:cloud_firestore/cloud_firestore.dart';

enum TeamStatus { waiting, playing, paused, finished }

enum EndingChoice { isolate, release }

class TeamDoc {
  const TeamDoc({
    required this.id,
    required this.name,
    required this.joinCode,
    required this.status,
    required this.createdAt,
    required this.timeLimit,
    required this.pausedDuration,
    required this.members,
    required this.currentFragmentIndex,
    this.startedAt,
    this.endingChoice,
  });

  final String id;
  final String name;
  final String joinCode;
  final TeamStatus status;
  final Timestamp createdAt;
  final Timestamp? startedAt;
  final int timeLimit; // seconds
  final int pausedDuration; // seconds
  final List<String> members;
  final int currentFragmentIndex;
  final EndingChoice? endingChoice;

  factory TeamDoc.fromSnapshot(DocumentSnapshot<Map<String, dynamic>> snap) {
    final d = snap.data()!;
    return TeamDoc(
      id: snap.id,
      name: d['name'] as String,
      joinCode: d['joinCode'] as String,
      status: _parseStatus(d['status'] as String),
      createdAt: d['createdAt'] as Timestamp,
      startedAt: d['startedAt'] as Timestamp?,
      timeLimit: (d['timeLimit'] as num?)?.toInt() ?? 3600,
      pausedDuration: (d['pausedDuration'] as num?)?.toInt() ?? 0,
      members: List<String>.from(d['members'] as List),
      currentFragmentIndex: (d['currentFragmentIndex'] as num?)?.toInt() ?? 0,
      endingChoice: _parseEnding(d['endingChoice'] as String?),
    );
  }

  static TeamStatus _parseStatus(String s) => switch (s) {
        'playing' => TeamStatus.playing,
        'paused' => TeamStatus.paused,
        'finished' => TeamStatus.finished,
        _ => TeamStatus.waiting,
      };

  static EndingChoice? _parseEnding(String? s) => switch (s) {
        'ISOLATE' => EndingChoice.isolate,
        'RELEASE' => EndingChoice.release,
        _ => null,
      };

  /// Remaining seconds of run time (accounts for paused time).
  /// Returns null if the run hasn't started yet.
  int? get remainingSeconds {
    if (startedAt == null) return null;
    final elapsed = DateTime.now().millisecondsSinceEpoch ~/ 1000 -
        startedAt!.seconds -
        pausedDuration;
    return (timeLimit - elapsed).clamp(0, timeLimit);
  }
}
