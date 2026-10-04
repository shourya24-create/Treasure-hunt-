/// core/models/team.dart — A team, as the player sees it and as the admin sees it.
///
/// TeamView mirrors /teamViews (player-safe: no route, no next-checkpoint ID,
/// no points, no decision result). TeamDoc mirrors /teams, which Firestore
/// rules let only facilitators read.
library;

import 'package:cloud_firestore/cloud_firestore.dart';

import 'chapter.dart';
import 'checkpoint.dart';
import 'route.dart';

enum TeamStatus { waiting, playing, atFinal, finished }

TeamStatus parseTeamStatus(Object? s) => switch (s) {
      'playing' => TeamStatus.playing,
      'atFinal' => TeamStatus.atFinal,
      'finished' => TeamStatus.finished,
      _ => TeamStatus.waiting,
    };

DateTime? _date(Object? value) => value is Timestamp ? value.toDate() : null;

/// "T5 · Team Name" — so nobody confuses team numbers (UI.md §4.3).
String teamLabel(String id, String name) => name == id ? id : '$id · $name';

// ── Player side ───────────────────────────────────────────────────────────────

/// One cleared fragment, as the Archive Log shows it. Numbered by order of
/// completion, never by checkpoint, so it cannot reveal the route.
class ArchiveEntry {
  const ArchiveEntry({
    required this.n,
    required this.chapter,
    this.clearedAt,
    this.stationReaction,
    this.locationClue,
    this.objectHint,
  });

  /// 1 = CP1, then the campus checkpoints in the order the team cleared them.
  final int n;
  final DateTime? clearedAt;

  /// The chapter this fragment unlocked.
  final ChapterView chapter;

  /// Null for CP1, which has no station.
  final ReactionView? stationReaction;

  /// The riddle that led here. Null when the paper named the place.
  final String? locationClue;

  /// Null for CP1, which has no scan object.
  final ObjectHintView? objectHint;

  static ArchiveEntry? fromMap(Map<String, dynamic>? m) {
    final chapter = asMap(m?['chapter']);
    if (m == null || chapter == null) return null;
    return ArchiveEntry(
      n: (m['n'] as num?)?.toInt() ?? 0,
      clearedAt: _date(m['clearedAt']),
      chapter: ChapterView.fromMap(chapter),
      stationReaction: ReactionView.fromMap(asMap(m['stationReaction'])),
      locationClue: m['locationClue'] as String?,
      objectHint: ObjectHintView.fromMap(asMap(m['objectHint'])),
    );
  }
}

class TeamView {
  const TeamView({
    required this.id,
    required this.name,
    required this.status,
    required this.paused,
    required this.cp1Done,
    required this.step,
    required this.returnToBase,
    required this.chapters,
    required this.archive,
    required this.finalArrived,
    this.pendingReward,
    this.activeCheckpoint,
    this.objectHint,
    this.locationClue,
    this.decision,
    this.decidedAt,
    this.helpRequestedAt,
  });

  /// CP1 + the 7 campus checkpoints.
  static const totalCheckpoints = 8;

  final String id;
  final String name;
  final TeamStatus status;
  final bool paused;
  final bool cp1Done;

  /// Campus checkpoints solved so far (0–7).
  final int step;

  /// Set after the gate code or a solve, until this phone has played it.
  final PendingReward? pendingReward;

  /// Set once the scan object matched and the AR activity is open.
  final String? activeCheckpoint;
  final ObjectHintView? objectHint;

  /// Null straight after CP1: the paper named the first place.
  final String? locationClue;
  final bool returnToBase;

  /// Unlocked chapters, in chapter order.
  final List<ChapterView> chapters;

  /// Cleared fragments, oldest first.
  final List<ArchiveEntry> archive;
  final bool finalArrived;

  /// 'DESTROY' | 'KEEP', once a club member has recorded it.
  final String? decision;
  final DateTime? decidedAt;
  final DateTime? helpRequestedAt;

  factory TeamView.fromSnapshot(DocumentSnapshot<Map<String, dynamic>> snap) {
    final d = snap.data()!;
    return TeamView(
      id: snap.id,
      name: d['name'] as String? ?? snap.id,
      status: parseTeamStatus(d['status']),
      paused: d['paused'] as bool? ?? false,
      cp1Done: d['cp1Done'] as bool? ?? false,
      step: (d['step'] as num?)?.toInt() ?? 0,
      pendingReward: PendingReward.fromMap(asMap(d['pendingReward'])),
      activeCheckpoint: d['activeCheckpoint'] as String?,
      objectHint: ObjectHintView.fromMap(asMap(d['objectHint'])),
      locationClue: d['locationClue'] as String?,
      returnToBase: d['returnToBase'] as bool? ?? false,
      chapters: (d['chapters'] as List? ?? const [])
          .map((c) => ChapterView.fromMap(Map<String, dynamic>.from(c as Map)))
          .toList()
        ..sort((a, b) => a.n.compareTo(b.n)),
      archive: [
        for (final e in d['archive'] as List? ?? const [])
          if (ArchiveEntry.fromMap(asMap(e)) case final entry?) entry,
      ]..sort((a, b) => a.n.compareTo(b.n)),
      finalArrived: d['finalArrived'] as bool? ?? false,
      decision: d['decision'] as String?,
      decidedAt: _date(d['decidedAt']),
      helpRequestedAt: _date(d['helpRequestedAt']),
    );
  }

  String get label => teamLabel(id, name);

  /// Checkpoints completed, CP1 included (0–8).
  int get completions => (cp1Done ? 1 : 0) + step;
}

// ── Admin side ────────────────────────────────────────────────────────────────

class CheckpointDone {
  const CheckpointDone({
    required this.cp,
    required this.solvedAt,
    required this.forced,
    this.arrivedAt,
  });

  final String cp;
  final DateTime? arrivedAt;
  final DateTime solvedAt;

  /// An admin force-completed it.
  final bool forced;
}

class HintTaken {
  const HintTaken({required this.cp, required this.at});
  final String cp;
  final DateTime at;
}

class TeamLocation {
  const TeamLocation({
    required this.lat,
    required this.lng,
    required this.accuracy,
    required this.at,
  });

  final double lat;
  final double lng;
  final double accuracy;
  final DateTime at;
}

class TeamDoc {
  const TeamDoc({
    required this.id,
    required this.name,
    required this.status,
    required this.paused,
    required this.routeStart,
    required this.order,
    required this.done,
    required this.hints,
    required this.points,
    this.cp1DoneAt,
    this.cp1Forced = false,
    this.deviceUid,
    this.arrivalCp,
    this.arrivalAt,
    this.finalArrivedAt,
    this.viewingStartedAt,
    this.decision,
    this.decidedAt,
    this.decisionCorrect,
    this.lastProgressAt,
    this.location,
    this.lastSeenAt,
    this.helpRequestedAt,
  });

  final String id;
  final String name;
  final TeamStatus status;
  final bool paused;

  /// The seeded start checkpoint, before any admin swap or reorder.
  final String routeStart;

  /// Full visiting order, after any admin swap or reorder.
  final List<String> order;

  /// Campus checkpoints completed, in the order they were completed.
  final List<CheckpointDone> done;
  final List<HintTaken> hints;
  final int points;
  final DateTime? cp1DoneAt;
  final bool cp1Forced;
  final String? deviceUid;

  /// Scanned but not yet solved.
  final String? arrivalCp;
  final DateTime? arrivalAt;
  final DateTime? finalArrivedAt;
  final DateTime? viewingStartedAt;
  final String? decision;
  final DateTime? decidedAt;
  final bool? decisionCorrect;
  final DateTime? lastProgressAt;
  final TeamLocation? location;

  /// Last heartbeat from the team's phone.
  final DateTime? lastSeenAt;
  final DateTime? helpRequestedAt;

  factory TeamDoc.fromSnapshot(DocumentSnapshot<Map<String, dynamic>> snap) {
    final d = snap.data()!;
    final route = asMap(d['route']) ?? const {};
    final start = route['start'] as String? ?? 'CP2';
    final override = d['routeOverride'] as List?;
    final arrival = asMap(d['arrival']);
    final loc = asMap(d['location']);

    return TeamDoc(
      id: snap.id,
      name: d['name'] as String? ?? snap.id,
      status: parseTeamStatus(d['status']),
      paused: d['paused'] as bool? ?? false,
      routeStart: start,
      order: override != null
          ? List<String>.from(override)
          : routeOrder(start, route['direction'] as String? ?? 'forward'),
      done: [
        for (final e in d['checkpointsDone'] as List? ?? const [])
          CheckpointDone(
            cp: (e as Map)['cp'] as String,
            arrivedAt: _date(e['arrivedAt']),
            solvedAt: _date(e['solvedAt']) ?? DateTime.fromMillisecondsSinceEpoch(0),
            forced: e['via'] == 'force',
          ),
      ],
      hints: [
        for (final e in d['hintsTaken'] as List? ?? const [])
          HintTaken(
            cp: (e as Map)['cp'] as String,
            at: _date(e['at']) ?? DateTime.fromMillisecondsSinceEpoch(0),
          ),
      ],
      points: (d['points'] as num?)?.toInt() ?? 0,
      cp1DoneAt: _date(d['cp1DoneAt']),
      cp1Forced: d['cp1Via'] == 'force',
      deviceUid: d['deviceUid'] as String?,
      arrivalCp: arrival?['cp'] as String?,
      arrivalAt: _date(arrival?['at']),
      finalArrivedAt: _date(d['finalArrivedAt']),
      viewingStartedAt: _date(d['viewingStartedAt']),
      decision: d['decision'] as String?,
      decidedAt: _date(d['decidedAt']),
      decisionCorrect: d['decisionCorrect'] as bool?,
      lastProgressAt: _date(d['lastProgressAt']),
      location: loc == null
          ? null
          : TeamLocation(
              lat: (loc['lat'] as num).toDouble(),
              lng: (loc['lng'] as num).toDouble(),
              accuracy: (loc['accuracy'] as num?)?.toDouble() ?? 0,
              at: _date(loc['at']) ?? DateTime.fromMillisecondsSinceEpoch(0),
            ),
      lastSeenAt: _date(d['lastSeenAt']),
      helpRequestedAt: _date(d['helpRequestedAt']),
    );
  }

  String get label => teamLabel(id, name);
  int get number => teamNumber(id);

  bool get cp1Done => cp1DoneAt != null;

  /// Campus checkpoints solved so far (0–7).
  int get step => done.length;

  List<String> get doneIds => [for (final d in done) d.cp];

  /// Checkpoints still to visit, in order.
  List<String> get remaining {
    final visited = doneIds;
    return order.where((cp) => !visited.contains(cp)).toList();
  }

  String? get nextCheckpoint => remaining.firstOrNull;

  /// The checkpoint the team is working on right now, CP1 included.
  String? get currentCheckpoint => cp1Done ? nextCheckpoint : 'CP1';

  /// On campus with a checkpoint still to reach.
  bool get onCampus => status == TeamStatus.playing && nextCheckpoint != null;

  /// The paper variant the volunteer hands this team (GAMEPLAY.md §4.2). The
  /// paper names the first checkpoint the team will visit, so it follows the
  /// current order: an admin may reroute a team before CP1.
  String get paperVariant => 'P-${order.firstOrNull ?? routeStart}';

  // Score breakdown (GAMEPLAY.md §6), so organisers can explain any result.
  int get checkpointPoints => 100 * ((cp1Done ? 1 : 0) + step);
  int get hintPoints => 20 * hints.length;
  int get decisionPoints => decisionCorrect == true ? 100 : 0;
}

/// Leaderboard order: most points first; a tie goes to the earlier finish time.
/// With `sealed`, the decision bonus is left out so it cannot be read off the order.
int compareForLeaderboard(TeamDoc a, TeamDoc b, {bool sealed = false}) {
  final ap = a.points - (sealed ? a.decisionPoints : 0);
  final bp = b.points - (sealed ? b.decisionPoints : 0);
  if (ap != bp) return bp.compareTo(ap);
  final at = a.decidedAt, bt = b.decidedAt;
  if (at != null && bt != null && at != bt) return at.compareTo(bt);
  if (at != null && bt == null) return -1;
  if (at == null && bt != null) return 1;
  return a.number.compareTo(b.number);
}
