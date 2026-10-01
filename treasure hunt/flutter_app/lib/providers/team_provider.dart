/// providers/team_provider.dart — ChangeNotifier that owns the active team state.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/team_doc.dart';
import '../models/quest_record.dart';
import '../services/team_service.dart';

class TeamProvider extends ChangeNotifier {
  TeamProvider({required TeamService teamService}) : _service = teamService;

  final TeamService _service;

  String? _teamId;
  TeamDoc? _team;
  List<QuestRecord> _fragments = [];
  String? _error;
  bool _loading = false;

  String? get teamId => _teamId;
  TeamDoc? get team => _team;
  List<QuestRecord> get fragments => _fragments;
  String? get error => _error;
  bool get loading => _loading;

  StreamSubscription<TeamDoc>? _teamSub;
  StreamSubscription<List<QuestRecord>>? _fragmentsSub;

  // ── attach / detach ───────────────────────────────────────────────────────────

  void attach(String teamId) {
    if (_teamId == teamId) return;
    detach();
    _teamId = teamId;

    _teamSub = _service.watchTeam(teamId).listen(
      (doc) {
        _team = doc;
        notifyListeners();
      },
      onError: (e) {
        _error = e.toString();
        notifyListeners();
      },
    );

    _fragmentsSub = _service.watchFragments(teamId).listen(
      (list) {
        _fragments = list;
        notifyListeners();
      },
      onError: (e) {
        _error = e.toString();
        notifyListeners();
      },
    );
  }

  void detach() {
    _teamSub?.cancel();
    _fragmentsSub?.cancel();
    _teamId = null;
    _team = null;
    _fragments = [];
    _error = null;
  }

  // ── actions ───────────────────────────────────────────────────────────────────

  Future<({String teamId, String joinCode})> createTeam(String name) async {
    _setLoading(true);
    try {
      final result = await _service.createTeam(name);
      attach(result.teamId);
      return result;
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  Future<String> joinTeam(String code) async {
    _setLoading(true);
    try {
      final result = await _service.joinTeam(code);
      attach(result.teamId);
      return result.teamId;
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  void _setLoading(bool v) {
    _loading = v;
    notifyListeners();
  }

  @override
  void dispose() {
    detach();
    super.dispose();
  }
}
