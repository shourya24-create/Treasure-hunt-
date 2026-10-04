/// core/providers/admin_providers.dart — Who the facilitator is, and the live
/// data every admin tab shares.
///
/// AdminSessionProvider resolves the signed-in user's role. AdminDataProvider
/// holds the teams, the game state and the audit trail from Firestore streams
/// and derives the alerts, so no tab needs a refresh button (UI.md §4.3).
library;

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../models/game.dart';
import '../models/route.dart';
import '../models/team.dart';
import '../services/admin_service.dart';
import '../services/auth_service.dart';
import '../services/team_service.dart';
import 'game_clock_provider.dart';

// ── Session ───────────────────────────────────────────────────────────────────

class AdminSessionProvider extends ChangeNotifier {
  AdminSessionProvider({
    required AuthService authService,
    required AdminService adminService,
  })  : _auth = authService,
        _admin = adminService {
    _authSub = _auth.authStateChanges.listen(_bind);
  }

  /// How long to wait before asking again when the role could not be read.
  static const _retryAfter = Duration(seconds: 5);

  final AuthService _auth;
  final AdminService _admin;
  StreamSubscription<User?>? _authSub;

  FacilitatorRole? _role;
  bool _resolved = false;

  /// Goes up with every sign-in and sign-out, so a lookup that a newer one
  /// has overtaken can tell, and drops its answer.
  int _bindings = 0;

  /// Null for players and for anyone without a facilitator document.
  FacilitatorRole? get role => _role;

  /// False while the role of a just-signed-in user is still being looked up.
  bool get resolved => _resolved;

  bool get isAdmin => _role == FacilitatorRole.admin;

  Future<void> _bind(User? user) async {
    final binding = ++_bindings;
    // Team phones sign in anonymously and are never facilitators.
    if (user == null || user.isAnonymous) {
      _role = null;
      _resolved = true;
      notifyListeners();
      return;
    }
    _resolved = false;
    notifyListeners();

    FacilitatorRole? role;
    while (true) {
      try {
        role = await _admin.roleOf(user.uid);
        break;
      } catch (_) {
        // Not read is not "not a facilitator". Stay unresolved and ask again,
        // so a dashboard reloaded on a bad network opens once it clears.
        await Future<void>.delayed(_retryAfter);
      }
      if (binding != _bindings) return;
    }
    if (binding != _bindings) return;
    _role = role;
    _resolved = true;
    notifyListeners();
  }

  @override
  void dispose() {
    // Ends a lookup that is still waiting or retrying.
    _bindings++;
    _authSub?.cancel();
    super.dispose();
  }
}

// ── Alerts (UI.md §4.2 LIVE) ──────────────────────────────────────────────────

enum AlertLevel { failure, warning }

class AdminAlert {
  const AdminAlert({
    required this.level,
    required this.message,
    this.at,
    this.teamId,
    this.isHelp = false,
  });

  final AlertLevel level;
  final String message;
  final DateTime? at;
  final String? teamId;

  /// Help alerts stay until an admin presses RESOLVE; the rest clear themselves.
  final bool isHelp;
}

/// A checkpoint at 3 teams is a warning; at 4 or more it is a failure.
const crowdWarning = 3;
const crowdLimit = 4;

const _offlineAfter = Duration(minutes: 2);
const _idleAfter = Duration(minutes: 15);

// ── Live data ─────────────────────────────────────────────────────────────────

class AdminDataProvider extends ChangeNotifier {
  AdminDataProvider({
    required AdminService adminService,
    required TeamService teamService,
    required AdminSessionProvider session,
    required GameClockProvider clock,
  })  : _admin = adminService,
        _teamService = teamService,
        _session = session,
        _gameClock = clock {
    _session.addListener(_sync);
    _sync();
  }

  final AdminService _admin;
  final TeamService _teamService;
  final AdminSessionProvider _session;
  final GameClockProvider _gameClock;

  StreamSubscription<List<TeamDoc>>? _teamsSub;
  StreamSubscription<GameState>? _gameSub;
  StreamSubscription<List<AdminCommand>>? _commandsSub;
  bool _listening = false;

  List<TeamDoc> _teams = const [];
  GameState _game = GameState.initial;
  List<AdminCommand> _commands = const [];
  bool _loaded = false;
  String? _error;

  List<TeamDoc> get teams => _teams;
  GameState get game => _game;

  /// The audit trail, newest first.
  List<AdminCommand> get commands => _commands;
  bool get loaded => _loaded;
  String? get error => _error;

  TeamDoc? team(String id) {
    for (final t in _teams) {
      if (t.id == id) return t;
    }
    return null;
  }

  // Streams run only while a facilitator is signed in.
  void _sync() {
    final shouldListen = _session.role != null;
    if (shouldListen == _listening) return;
    _listening = shouldListen;
    _teamsSub?.cancel();
    _gameSub?.cancel();
    _commandsSub?.cancel();
    if (!shouldListen) {
      _teams = const [];
      _commands = const [];
      _loaded = false;
      notifyListeners();
      return;
    }

    _teamsSub = _admin.watchAllTeams().listen(
      (teams) {
        _teams = teams;
        _loaded = true;
        _error = null;
        notifyListeners();
      },
      onError: (Object e) {
        _error = e.toString();
        _loaded = true;
        notifyListeners();
      },
    );
    _gameSub = _teamService.watchGame().listen(
      (game) {
        _game = game;
        notifyListeners();
      },
      // The last known game state stays on screen. Any signed-in user may
      // read it, so an error here means the session is gone, and the teams
      // stream above is the one that reports that.
      onError: (Object _) {},
    );
    _commandsSub = _admin.watchCommands().listen(
      (commands) {
        _commands = commands;
        notifyListeners();
      },
      onError: (Object _) {},
    );
    _ping();
  }

  // ── server clock ──────────────────────────────────────────────────────────────

  /// Asks the server for its time, so the countdown is right on a laptop
  /// whose clock is not, even before the first action is sent.
  Future<void> _ping() async {
    try {
      _correctClock(await _admin.act('ping'));
    } catch (_) {
      // The next action that goes through corrects the clock instead.
    }
  }

  void _correctClock(Map<String, dynamic> response) {
    final serverNow = serverTimeOf(response);
    if (serverNow != null) _gameClock.syncWithServer(serverNow);
  }

  // ── actions ───────────────────────────────────────────────────────────────────

  /// Sends one facilitator action. Returns null on success, or the error text.
  Future<String?> act(
    String type, {
    String? teamId,
    String? checkpointId,
    String? decision,
  }) async {
    try {
      final response = await _admin.act(
        type,
        teamId: teamId,
        checkpointId: checkpointId,
        decision: decision,
      );
      _correctClock(response);
      return null;
    } catch (e) {
      return readableError(e);
    }
  }

  // ── derived views ─────────────────────────────────────────────────────────────

  /// Teams that have scanned this checkpoint's object and not yet solved it.
  List<TeamDoc> teamsAt(String cp) =>
      _teams.where((t) => t.onCampus && t.arrivalCp == cp).toList();

  /// Teams whose next checkpoint this is, still on their way.
  List<TeamDoc> teamsInbound(String cp) => _teams
      .where((t) => t.onCampus && t.arrivalCp == null && t.nextCheckpoint == cp)
      .toList();

  /// Teams the game expects to reach by phone right now. A team at the final
  /// is in the room with the club, so its phone no longer matters.
  bool _expectedOnline(TeamDoc t) =>
      t.deviceUid != null &&
      _game.started &&
      t.status != TeamStatus.atFinal &&
      t.status != TeamStatus.finished;

  bool isOffline(TeamDoc t, DateTime now) {
    final seen = t.lastSeenAt;
    return _expectedOnline(t) &&
        (seen == null || now.difference(seen) > _offlineAfter);
  }

  bool isIdle(TeamDoc t, DateTime now) {
    final progress = t.lastProgressAt;
    return t.onCampus &&
        !_game.closed(now) &&
        progress != null &&
        now.difference(progress) > _idleAfter;
  }

  /// Newest first; failures before warnings at the same time.
  List<AdminAlert> alerts(DateTime now) {
    final out = <AdminAlert>[];

    for (final cp in campusCheckpoints) {
      final count = teamsAt(cp).length;
      if (count >= crowdLimit) {
        out.add(AdminAlert(
          level: AlertLevel.failure,
          message: '$cp HAS $count TEAMS — REROUTE AN INBOUND TEAM',
        ));
      } else if (count == crowdWarning) {
        out.add(AdminAlert(
          level: AlertLevel.warning,
          message: '$cp HAS $count TEAMS',
        ));
      }
    }

    for (final t in _teams) {
      if (t.helpRequestedAt != null) {
        out.add(AdminAlert(
          level: AlertLevel.failure,
          message: 'PRESSED I NEED HELP',
          at: t.helpRequestedAt,
          teamId: t.id,
          isHelp: true,
        ));
      }
      if (isOffline(t, now)) {
        out.add(AdminAlert(
          level: AlertLevel.failure,
          message: 'PHONE OFFLINE ${formatAgo(t.lastSeenAt, now)}',
          at: t.lastSeenAt,
          teamId: t.id,
        ));
      }
      if (isIdle(t, now)) {
        out.add(AdminAlert(
          level: AlertLevel.warning,
          message: 'NO PROGRESS FOR ${formatAgo(t.lastProgressAt, now)}',
          at: t.lastProgressAt,
          teamId: t.id,
        ));
      }
    }

    int rank(AdminAlert a) => a.level == AlertLevel.failure ? 0 : 1;
    out.sort((a, b) {
      if (rank(a) != rank(b)) return rank(a).compareTo(rank(b));
      final at = a.at, bt = b.at;
      if (at == null || bt == null) return at == null ? (bt == null ? 0 : -1) : 1;
      return bt.compareTo(at);
    });
    return out;
  }

  @override
  void dispose() {
    _session.removeListener(_sync);
    _teamsSub?.cancel();
    _gameSub?.cancel();
    _commandsSub?.cancel();
    super.dispose();
  }
}
