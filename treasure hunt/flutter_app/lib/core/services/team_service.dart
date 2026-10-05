/// core/services/team_service.dart — What the team's one phone may do and read.
///
/// The app never writes to Firestore: every change goes through a callable
/// (see backend_call.dart). recordArrival is not here — the scanner at
/// /field/scan calls it itself.
library;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/game.dart';
import '../models/team.dart';
import 'backend_call.dart';

/// The latest team view, plus whether it came from the server just now.
typedef ViewSnapshot = ({TeamView? view, bool online});

class TeamService {
  TeamService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  })  : _db = firestore ?? FirebaseFirestore.instance,
        _fn = functions ?? FirebaseFunctions.instance;

  final FirebaseFirestore _db;
  final FirebaseFunctions _fn;

  // ── player actions ────────────────────────────────────────────────────────────

  /// Binds this phone to the team. Refused if another phone already holds it.
  Future<void> claimTeam({
    required String teamId,
    required String password,
  }) =>
      callFunction(_fn, 'claimTeam', {'teamId': teamId, 'loginCode': password});

  /// CP1: the code a volunteer hands over once the paper puzzle is solved.
  /// Returns false for a wrong code; there is no penalty.
  Future<bool> enterGateCode({
    required String teamId,
    required String code,
  }) async {
    final result = await callFunction(
      _fn,
      'enterGateCode',
      {'teamId': teamId, 'code': code},
    );
    return result['accepted'] as bool? ?? false;
  }

  /// The team's answer for the fragment its scan unlocked. Returns false for
  /// a wrong answer; the team may try again, with no penalty.
  Future<bool> submitAnswer({
    required String teamId,
    required String checkpointId,
    required Object answer,
  }) async {
    final result = await callFunction(
      _fn,
      'submitAnswer',
      {'teamId': teamId, 'checkpointId': checkpointId, 'answer': answer},
    );
    return result['correct'] as bool? ?? false;
  }

  /// The reward ending in chapter `chapter` has been played on this phone.
  /// Naming the chapter keeps a completion that lands at the same moment
  /// (an admin force-complete, say) from being marked as played unseen.
  Future<void> ackReward(String teamId, int chapter) =>
      callFunction(_fn, 'ackReward', {'teamId': teamId, 'chapter': chapter});

  /// "I NEED HELP": raises an alert on the admin dashboard.
  Future<void> requestHelp(String teamId) =>
      callFunction(_fn, 'requestHelp', {'teamId': teamId});

  /// Heartbeat, with the GPS fix when location is available. Returns the
  /// server's clock, which the countdown follows instead of the phone's own.
  Future<DateTime?> reportLocation({
    required String teamId,
    double? lat,
    double? lng,
    double? accuracy,
  }) async {
    final result = await callFunction(_fn, 'reportLocation', {
      'teamId': teamId,
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
      if (accuracy != null) 'accuracy': accuracy,
    });
    return serverTimeOf(result);
  }

  // ── Firestore streams ─────────────────────────────────────────────────────────

  /// The view of whichever team this phone has claimed, or null if none.
  /// `online` turns false when Firestore falls back to its cache. A null view
  /// from the cache is no answer: it only means nothing is stored on the phone.
  Stream<ViewSnapshot> watchMyView(String uid) => _db
      .collection('teamViews')
      .where('deviceUid', isEqualTo: uid)
      .limit(1)
      .snapshots(includeMetadataChanges: true)
      .map(
        (qs) => (
          view: qs.docs.isEmpty ? null : TeamView.fromSnapshot(qs.docs.first),
          online: !qs.metadata.isFromCache,
        ),
      );

  Stream<GameState> watchGame() => _db
      .collection('game')
      .doc('state')
      .snapshots()
      .map((snap) => GameState.fromMap(snap.data()));
}
