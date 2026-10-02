/// services/team_service.dart — Firestore + Cloud Functions calls for team operations.
///
/// Phase 4 hardening: all Cloud Function calls use a 10-second timeout
/// so a network hang does not leave the UI frozen indefinitely.
library;

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/team_doc.dart';
import '../models/quest_record.dart';

class TeamService {
  TeamService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  })  : _db = firestore ?? FirebaseFirestore.instance,
        _fn = functions ?? FirebaseFunctions.instance;

  final FirebaseFirestore _db;
  final FirebaseFunctions _fn;

  // ── helpers ──────────────────────────────────────────────────────────────────

  Future<HttpsCallableResult<T>> _call<T>(
    String name,
    Map<String, dynamic> data,
  ) =>
      _fn
          .httpsCallable(name)
          .call<T>(data)
          .timeout(
            const Duration(seconds: 10),
            // Phase 4: 10-second timeout prevents indefinite hangs.
            onTimeout: () => throw TimeoutException(
              '$name call timed out after 10 seconds.',
            ),
          );

  // ── team lifecycle ────────────────────────────────────────────────────────────

  Future<({String teamId, String joinCode})> createTeam(String teamName) async {
    final result = await _call<Map<String, dynamic>>(
      'createTeam',
      {'teamName': teamName},
    );
    return (
      teamId: result.data['teamId'] as String,
      joinCode: result.data['joinCode'] as String,
    );
  }

  Future<({String teamId, bool alreadyMember})> joinTeam(String joinCode) async {
    final result = await _call<Map<String, dynamic>>(
      'joinTeam',
      {'joinCode': joinCode},
    );
    return (
      teamId: result.data['teamId'] as String,
      alreadyMember: result.data['alreadyMember'] as bool,
    );
  }

  Future<bool> submitAnswer({
    required String teamId,
    required String fragmentId,
    required dynamic answer,
  }) async {
    final result = await _call<Map<String, dynamic>>(
      'submitAnswer',
      {'teamId': teamId, 'fragmentId': fragmentId, 'answer': answer},
    );
    return result.data['correct'] as bool;
  }

  Future<bool> verifyStationCode({
    required String teamId,
    required String fragmentId,
    required String code,
  }) async {
    final result = await _call<Map<String, dynamic>>(
      'verifyStationCode',
      {'teamId': teamId, 'fragmentId': fragmentId, 'code': code},
    );
    return result.data['verified'] as bool;
  }

  Future<String> submitFinalDecision({
    required String teamId,
    required String choice, // 'ISOLATE' | 'RELEASE'
  }) async {
    final result = await _call<Map<String, dynamic>>(
      'submitFinalDecision',
      {'teamId': teamId, 'choice': choice},
    );
    return result.data['endingChoice'] as String;
  }

  // ── Firestore streams ─────────────────────────────────────────────────────────

  Stream<TeamDoc> watchTeam(String teamId) => _db
      .collection('teams')
      .doc(teamId)
      .withConverter<TeamDoc>(
        fromFirestore: (snap, _) => TeamDoc.fromSnapshot(snap),
        toFirestore: (_, __) => {},
      )
      .snapshots()
      .map((s) => s.data()!);

  Stream<List<QuestRecord>> watchFragments(String teamId) => _db
      .collection('teams')
      .doc(teamId)
      .collection('fragments')
      .snapshots()
      .map(
        (qs) => qs.docs
            .map((d) => QuestRecord.fromSnapshot(d))
            .toList()
          ..sort((a, b) => a.fragmentId.compareTo(b.fragmentId)),
      );

  /// Facilitator: reads ALL teams (requires facilitator Firestore rules).
  Stream<List<TeamDoc>> watchAllTeams() => _db
      .collection('teams')
      .orderBy('createdAt', descending: true)
      .snapshots()
      .map(
        (qs) => qs.docs
            .map((d) => TeamDoc.fromSnapshot(d))
            .toList(),
      );

  // ── facilitator actions ───────────────────────────────────────────────────────

  Future<void> sendFacilitatorAction({
    required String type,
    required String teamId,
    String? fragmentId,
    int? hintLevel,
  }) async {
    await _call<Map<String, dynamic>>('facilitatorAction', {
      'type': type,
      'teamId': teamId,
      if (fragmentId != null) 'fragmentId': fragmentId,
      if (hintLevel != null) 'hintLevel': hintLevel,
    });
  }
}
