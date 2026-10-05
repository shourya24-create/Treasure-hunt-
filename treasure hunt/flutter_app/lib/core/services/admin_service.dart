/// core/services/admin_service.dart — What the admin dashboard reads and sends.
///
/// Every action goes through the `facilitatorAction` backend function. The
/// admin app never writes to Firestore directly (UI.md §4.3).
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/team.dart';
import 'backend_call.dart';

/// 'admin' runs everything; 'desk' runs the gate desk and the final desk only.
enum FacilitatorRole { admin, desk }

/// One entry of the admin audit trail (/facilitatorCommands).
class AdminCommand {
  const AdminCommand({
    required this.type,
    required this.at,
    required this.facilitatorUid,
    required this.processed,
    this.teamId,
    this.checkpointId,
    this.decision,
  });

  final String type;
  final DateTime at;
  final String facilitatorUid;

  /// False if the server refused or failed the action. The entry is written
  /// before the action runs and marked once it has gone through, so it is
  /// also false for the moment an action is still running.
  final bool processed;
  final String? teamId;
  final String? checkpointId;
  final String? decision;

  factory AdminCommand.fromSnapshot(DocumentSnapshot<Map<String, dynamic>> snap) {
    final d = snap.data()!;
    return AdminCommand(
      type: d['type'] as String? ?? '',
      at: (d['issuedAt'] as Timestamp?)?.toDate() ?? DateTime.fromMillisecondsSinceEpoch(0),
      facilitatorUid: d['facilitatorUid'] as String? ?? '',
      processed: d['processed'] as bool? ?? false,
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

  /// A role read that fails is tried this many times in all, a little further
  /// apart each time, before `roleOf` gives up.
  static const _roleAttempts = 4;
  static const _roleRetryDelay = Duration(seconds: 1);

  /// A read that has not answered by then counts as failed.
  static const _roleTimeout = Duration(seconds: 10);

  final FirebaseFirestore _db;
  final FirebaseFunctions _fn;

  // ── who is signed in ──────────────────────────────────────────────────────────

  /// The signed-in user's facilitator role, or null if the server says they
  /// are not one. Throws if the document could not be read at all: on a
  /// flaky network that is no reason to call a facilitator "not a facilitator".
  Future<FacilitatorRole?> roleOf(String uid) async {
    for (var attempt = 1;; attempt++) {
      try {
        final snap = await _db
            .collection('facilitators')
            .doc(uid)
            .get()
            .timeout(_roleTimeout);
        if (!snap.exists) return null;
        return snap.data()?['role'] == 'desk'
            ? FacilitatorRole.desk
            : FacilitatorRole.admin;
      } catch (e) {
        // The rules have answered, and the answer is no.
        if (e is FirebaseException && e.code == 'permission-denied') return null;
        if (attempt == _roleAttempts) rethrow;
      }
      await Future<void>.delayed(_roleRetryDelay * attempt);
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
