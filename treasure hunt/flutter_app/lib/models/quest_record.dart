/// models/quest_record.dart — Dart mirror of QuestRecord + EvidenceCard.
library;

import 'package:cloud_firestore/cloud_firestore.dart';

enum FragmentStatus { locked, active, completed }

class EvidenceCard {
  const EvidenceCard({
    required this.id,
    required this.label,
    required this.unlockedAt,
    required this.data,
  });

  final String id;
  final String label;
  final Timestamp unlockedAt;
  final String data;

  factory EvidenceCard.fromMap(Map<String, dynamic> m) => EvidenceCard(
        id: m['id'] as String,
        label: m['label'] as String,
        unlockedAt: m['unlockedAt'] as Timestamp,
        data: m['data'] as String,
      );
}

class QuestRecord {
  const QuestRecord({
    required this.fragmentId,
    required this.status,
    required this.evidence,
    required this.hintsUsed,
    this.unlockedAt,
    this.completedAt,
  });

  final String fragmentId;
  final FragmentStatus status;
  final List<EvidenceCard> evidence;
  final int hintsUsed;
  final Timestamp? unlockedAt;
  final Timestamp? completedAt;

  factory QuestRecord.fromSnapshot(
    DocumentSnapshot<Map<String, dynamic>> snap,
  ) {
    final d = snap.data()!;
    return QuestRecord(
      fragmentId: d['fragmentId'] as String,
      status: _parseStatus(d['status'] as String),
      evidence: (d['evidence'] as List? ?? [])
          .map((e) => EvidenceCard.fromMap(e as Map<String, dynamic>))
          .toList(),
      hintsUsed: (d['hintsUsed'] as num?)?.toInt() ?? 0,
      unlockedAt: d['unlockedAt'] as Timestamp?,
      completedAt: d['completedAt'] as Timestamp?,
    );
  }

  static FragmentStatus _parseStatus(String s) => switch (s) {
        'active' => FragmentStatus.active,
        'completed' => FragmentStatus.completed,
        _ => FragmentStatus.locked,
      };
}
