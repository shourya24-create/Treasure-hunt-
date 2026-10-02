/// core/models/route.dart — Checkpoint IDs and route derivation (GAMEPLAY.md §5).
///
/// Admin side only. A player's phone never receives a route.
library;

/// The 7 campus checkpoints in walking order around the loop.
const campusCheckpoints = ['CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7', 'CP8'];
const allCheckpoints = ['CP1', ...campusCheckpoints];

const teamIds = [
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6',
  'T7', 'T8', 'T9', 'T10', 'T11', 'T12',
];

/// Pairs that share a start checkpoint. If both finish the paper together,
/// the volunteer may hold the second gate code for ~2–3 minutes (§5.5).
const sharedStartPairs = [
  ['T1', 'T8'],
  ['T2', 'T12'],
  ['T3', 'T9'],
  ['T5', 'T10'],
  ['T7', 'T11'],
];

/// Mirrors engine.routeOrder(): start + direction → full visiting order.
List<String> routeOrder(String start, String direction) {
  final n = campusCheckpoints.length;
  final from = campusCheckpoints.indexOf(start);
  final dir = direction == 'reverse' ? -1 : 1;
  return [
    for (var i = 0; i < n; i++) campusCheckpoints[((from + dir * i) % n + n) % n],
  ];
}

/// Sorts T1…T12 numerically rather than as text.
int teamNumber(String teamId) => int.tryParse(teamId.substring(1)) ?? 0;
