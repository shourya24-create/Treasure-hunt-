/// core/services/admin_service.dart — What the admin dashboard reads and sends.
///
/// Every action goes through the `facilitatorAction` backend function. The
/// admin app never writes to Firestore directly (UI.md §4.3).
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/team.dart';
import 'team_service.dart' show callFunction;

/// 'admin' runs everything; 'desk' runs the gate desk and the final desk only.
enum FacilitatorRole { admin, desk }

/// One entry of the admin audit trail (/facilitatorCommands).
class AdminCommand {
  const AdminCommand({
    required this.type,
    required this.at,
    required this.facilitatorUid,
    this.teamId,
    this.checkpointId,
    this.decision,
  });

  final String type;
  final DateTime at;
  final String facilitatorUid;
  final String? teamId;
  final String? checkpointId;
  final String? decision;

  factory AdminCommand.fromSnapshot(DocumentSnapshot<Map<String, dynamic>> snap) {
    final d = snap.data()!;
    return AdminCommand(
      type: d['type'] as String? ?? '',
      at: (d['issuedAt'] as Timestamp?)?.toDate() ?? DateTime.fromMillisecondsSinceEpoch(0),
      facilitatorUid: d['facilitatorUid'] as String? ?? '',
      teamId: d['teamId'] as String?,
      checkpointId: d['checkpointId'] as String?,
      decision: d['decision'] as String?,
    );
  }
}

/// How much of one content group in GAMEPLAY.md §8 has been delivered.
class ContentStatusItem {
  const ContentStatusItem({
    required this.label,
    required this.total,
    required this.delivered,
  });

  final String label;
  final int total;
  final int delivered;

  bool get complete => delivered >= total;
}

class AdminService {
  AdminService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  })  : _db = firestore ?? FirebaseFirestore.instance,
        _fn = functions ?? FirebaseFunctions.instance;

  final FirebaseFirestore _db;
  final FirebaseFunctions _fn;

  // ── who is signed in ──────────────────────────────────────────────────────────

  /// The signed-in user's facilitator role, or null if they are not one.
  Future<FacilitatorRole?> roleOf(String uid) async {
    try {
      final snap = await _db.collection('facilitators').doc(uid).get();
      if (!snap.exists) return null;
      return snap.data()?['role'] == 'desk'
          ? FacilitatorRole.desk
          : FacilitatorRole.admin;
    } catch (_) {
      return null;
    }
  }

  // ── Firestore streams ─────────────────────────────────────────────────────────

  /// Reads ALL teams (requires facilitator Firestore rules).
  Stream<List<TeamDoc>> watchAllTeams() => _db.collection('teams').snapshots().map(
        (qs) => qs.docs.map((d) => TeamDoc.fromSnapshot(d)).toList()
          ..sort((a, b) => a.number.compareTo(b.number)),
      );

  /// The audit trail, newest first.
  Stream<List<AdminCommand>> watchCommands() => _db
      .collection('facilitatorCommands')
      .orderBy('issuedAt', descending: true)
      .limit(300)
      .snapshots()
      .map((qs) => qs.docs.map((d) => AdminCommand.fromSnapshot(d)).toList());

  // ── facilitator actions ───────────────────────────────────────────────────────

  /// See FacilitatorActionType in functions/src/schema.ts for the verbs.
  Future<Map<String, dynamic>> act(
    String type, {
    String? teamId,
    String? checkpointId,
    String? decision,
  }) =>
      callFunction(_fn, 'facilitatorAction', {
        'type': type,
        if (teamId != null) 'teamId': teamId,
        if (checkpointId != null) 'checkpointId': checkpointId,
        if (decision != null) 'decision': decision,
      });

  /// Gate codes for the CP1 desk. They live only in the functions' content
  /// files, so they are fetched on demand and never stored on the client.
  Future<Map<String, String>> listGateCodes() async {
    final result = await act('listGateCodes');
    return Map<String, String>.from(result['codes'] as Map? ?? const {});
  }

  Future<List<ContentStatusItem>> contentStatus() async {
    final result = await act('contentStatus');
    return [
      for (final item in result['items'] as List? ?? const [])
        ContentStatusItem(
          label: (item as Map)['label'] as String? ?? '',
          total: (item['total'] as num?)?.toInt() ?? 0,
          delivered: (item['delivered'] as num?)?.toInt() ?? 0,
        ),
    ];
  }
}
