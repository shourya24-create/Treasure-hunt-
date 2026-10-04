/// core/services/team_service.dart — What the team's one phone may do and read.
///
/// Phase 4 hardening: all Cloud Function calls use a 10-second timeout
/// so a network hang does not leave the UI frozen indefinitely.
///
/// The app never writes to Firestore: every change goes through a callable.
/// recordArrival and submitAnswer are not here — the field AR app at /field/
/// calls those itself.
library;

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/game.dart';
import '../models/team.dart';

/// Calls a Cloud Function with a 10-second timeout and returns its result map.
Future<Map<String, dynamic>> callFunction(
  FirebaseFunctions functions,
  String name,
  Map<String, dynamic> data,
) async {
  final result = await functions.httpsCallable(name).call<dynamic>(data).timeout(
        const Duration(seconds: 10),
        onTimeout: () => throw TimeoutException(
          '$name call timed out after 10 seconds.',
        ),
      );
  return Map<String, dynamic>.from(result.data as Map);
}

/// Strips the Firebase wrapper off a callable error for display.
String readableError(Object error) {
  final text = error.toString();
  final match = RegExp(r'\[[^\]]+\]\s*(.*)$', dotAll: true).firstMatch(text);
  return (match?.group(1) ?? text).trim();
}

/// The server's clock from a callable's result (`serverTime`, in
/// milliseconds), or null if the result carries none.
DateTime? serverTimeOf(Map<String, dynamic> result) {
  final millis = result['serverTime'];
  return millis is num
      ? DateTime.fromMillisecondsSinceEpoch(millis.toInt())
      : null;
}

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
