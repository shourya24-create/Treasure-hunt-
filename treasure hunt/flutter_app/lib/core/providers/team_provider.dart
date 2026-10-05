/// core/providers/team_provider.dart — ChangeNotifier that owns the active team state.
///
/// Follows the signed-in phone: whichever team that phone has claimed is the
/// active team. If a facilitator releases the phone, the view stream goes
/// empty and the router falls back to the login.
library;

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/game.dart';
import '../models/team.dart';
import '../services/auth_service.dart';
import '../services/location_service.dart';
import '../services/team_service.dart';
import 'game_clock_provider.dart';

/// Where the team is in the game: decides the Home card, the open fragment
/// and the focus views (UI.md §3.4).
enum MissionStage {
  loading,
  waitingRoom,
  gateCode,
  reward,
  objective,
  returnToBase,
  finalQueue,
  complete,
  gameOver,
}

class TeamProvider extends ChangeNotifier {
  TeamProvider({
    required TeamService teamService,
    required AuthService authService,
    required LocationService locationService,
    required GameClockProvider clock,
  })  : _service = teamService,
        _auth = authService,
        _location = locationService,
        _gameClock = clock {
    _authSub = _auth.authStateChanges.listen(_bind);
    _gameClock.addListener(_onTick);
    _loadPreflight();
  }

  static const _preflightKey = 'preflightDone';

  final TeamService _service;
  final AuthService _auth;
  final LocationService _location;
  final GameClockProvider _gameClock;

  TeamView? _view;
  GameState _game = GameState.initial;

  /// Whether the game was closed at the clock's last tick.
  bool _closed = false;
  bool _resolved = false;
  bool _online = true;
  bool _preflightDone = false;
  bool _preflightKnown = false;

  /// The team this phone plays for, or null.
  TeamView? get view => _view;
  GameState get game => _game;

  /// False until the first answer about this phone's team has arrived.
  bool get resolved => _resolved;

  /// False while Firestore is serving from cache, i.e. the phone is offline.
  bool get online => _online;

  /// The camera / location / sound check has been passed on this phone.
  bool get preflightDone => _preflightDone;

  /// False until the stored preflight flag has been read.
  bool get preflightKnown => _preflightKnown;

  /// An admin has paused this team or everyone. Only matters on campus, and
  /// only while the game is open: a pause does not stop the 2-hour clock, and
  /// once the game has closed nothing may cover TIME'S UP.
  bool get paused {
    final status = _view?.status;
    return (status == TeamStatus.waiting || status == TeamStatus.playing) &&
        (_game.paused || (_view?.paused ?? false)) &&
        !_game.closed(_gameClock.now);
  }

  /// The stage the team is in at `now`. A reload lands on the same one.
  MissionStage stage(DateTime now) {
    final view = _view;
    if (!_resolved || view == null) return MissionStage.loading;
    if (view.status == TeamStatus.finished) return MissionStage.complete;
    if (view.status == TeamStatus.atFinal) return MissionStage.finalQueue;
    if (_game.closed(now)) return MissionStage.gameOver;
    if (view.pendingReward != null) return MissionStage.reward;
    if (!_game.started) return MissionStage.waitingRoom;
    if (!view.cp1Done) return MissionStage.gateCode;
    if (view.returnToBase) return MissionStage.returnToBase;
    return MissionStage.objective;
  }

  StreamSubscription<User?>? _authSub;
  StreamSubscription<ViewSnapshot>? _viewSub;
  StreamSubscription<GameState>? _gameSub;

  // ── binding to the signed-in phone ────────────────────────────────────────────

  void _bind(User? user) {
    _viewSub?.cancel();
    _gameSub?.cancel();
    _view = null;
    _game = GameState.initial;
    _online = true;
    _resolved = user == null;
    notifyListeners();
    if (user == null) {
      _location.stop();
      return;
    }

    _viewSub = _service.watchMyView(user.uid).listen(
      (snapshot) {
        _online = snapshot.online;
        // An empty answer from the cache only means the phone is offline with
        // nothing stored, as after a reload without signal. Whether it still
        // has a team is for the server to say, so the view stays as it was.
        if (snapshot.view != null || snapshot.online) {
          _view = snapshot.view;
          _resolved = true;
          _syncHeartbeat();
        }
        notifyListeners();
      },
      onError: (Object _) {
        _resolved = true;
        notifyListeners();
      },
    );

    _gameSub = _service.watchGame().listen(
      (game) {
        _game = game;
        notifyListeners();
      },
      onError: (Object _) {},
    );
  }

  void _syncHeartbeat() {
    final view = _view;
    if (view == null || view.status == TeamStatus.finished) {
      _location.stop();
    } else {
      _location.start(view.id);
    }
  }

  /// `paused` turns false when the game closes. The 2 hours running out is
  /// not a Firestore event, so the clock is what has to announce it.
  void _onTick() {
    final closed = _game.closed(_gameClock.now);
    if (closed == _closed) return;
    _closed = closed;
    notifyListeners();
  }

  Future<void> _loadPreflight() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _preflightDone = prefs.getBool(_preflightKey) ?? false;
    } catch (_) {
      // Without storage the preflight is simply shown again next time.
    }
    _preflightKnown = true;
    notifyListeners();
  }

  // ── actions ───────────────────────────────────────────────────────────────────

  /// Logs this phone in as `teamId`. Throws if another phone holds the team.
  Future<void> claimTeam(String teamId, String password) async {
    if (_auth.currentUser == null) await _auth.signInAnonymously();
    await _service.claimTeam(teamId: teamId, password: password);
  }

  /// CP1. Returns false for a wrong code; there is no penalty.
  Future<bool> enterGateCode(String code) =>
      _service.enterGateCode(teamId: _requireTeam(), code: code);

  /// Answers the fragment the scan unlocked. Returns false for a wrong
  /// answer; there is no penalty.
  Future<bool> submitAnswer(Object answer) {
    final checkpoint = _view?.activeCheckpoint;
    if (checkpoint == null) throw StateError('No fragment is unlocked.');
    return _service.submitAnswer(
      teamId: _requireTeam(),
      checkpointId: checkpoint,
      answer: answer,
    );
  }

  /// Called once the reward sequence has been played to the end, with the
  /// number of the chapter it ended on.
  Future<void> ackReward(int chapter) =>
      _service.ackReward(_requireTeam(), chapter);

  Future<void> requestHelp() => _service.requestHelp(_requireTeam());

  Future<void> completePreflight() async {
    _preflightDone = true;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_preflightKey, true);
    } catch (_) {}
  }

  String _requireTeam() {
    final teamId = _view?.id;
    if (teamId == null) throw StateError('No team on this phone.');
    return teamId;
  }

  @override
  void dispose() {
    _gameClock.removeListener(_onTick);
    _authSub?.cancel();
    _viewSub?.cancel();
    _gameSub?.cancel();
    _location.stop();
    super.dispose();
  }
}
