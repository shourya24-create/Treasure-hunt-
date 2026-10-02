/// core/services/location_service.dart — Heartbeat + GPS of the team's one phone.
///
/// Each team is tracked on its one phone for the whole event (GAMEPLAY.md
/// §4.1). A heartbeat goes out every 30 seconds, carrying the latest GPS fix
/// when there is one; that is how the admin dashboard knows the phone is
/// online. A denied permission is not fatal: the game still plays, and the
/// top bar shows that GPS is off.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import 'team_service.dart';

enum GpsState {
  /// Permission not asked yet.
  unknown,

  /// Sharing a good fix.
  sharing,

  /// Sharing, but the fix is rough.
  weak,

  /// Denied or unavailable.
  off,
}

class LocationService {
  LocationService({required TeamService teamService}) : _teams = teamService;

  static const _heartbeat = Duration(seconds: 30);

  /// A fix worse than this many metres counts as weak.
  static const _weakAccuracy = 50.0;

  final TeamService _teams;
  StreamSubscription<Position>? _sub;
  Timer? _timer;
  String? _teamId;
  Position? _last;

  final ValueNotifier<GpsState> gps = ValueNotifier<GpsState>(GpsState.unknown);

  /// Starts the heartbeat for `teamId`. Safe to call again for the same team.
  Future<void> start(String teamId) async {
    if (_teamId == teamId) return;
    await stop();
    _teamId = teamId;

    _timer = Timer.periodic(_heartbeat, (_) => _send());
    _send();
    await _listen();
  }

  /// Asks for location permission and starts listening. Returns true if granted.
  Future<bool> requestPermission() async {
    await _listen();
    return gps.value == GpsState.sharing || gps.value == GpsState.weak;
  }

  Future<void> _listen() async {
    await _sub?.cancel();
    _sub = null;
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        gps.value = GpsState.off;
        return;
      }

      // Until the first fix arrives, the state is not known to be good.
      gps.value = GpsState.weak;
      _sub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 5,
        ),
      ).listen(
        (position) {
          _last = position;
          gps.value = position.accuracy > _weakAccuracy
              ? GpsState.weak
              : GpsState.sharing;
        },
        onError: (Object _) => gps.value = GpsState.off,
      );
    } catch (_) {
      gps.value = GpsState.off;
    }
  }

  void _send() {
    final teamId = _teamId;
    if (teamId == null) return;
    final fix = _last;

    // A dropped heartbeat is harmless; the next one replaces it.
    _teams
        .reportLocation(
          teamId: teamId,
          lat: fix?.latitude,
          lng: fix?.longitude,
          accuracy: fix?.accuracy,
        )
        .catchError((Object _) {});
  }

  Future<void> stop() async {
    _timer?.cancel();
    _timer = null;
    await _sub?.cancel();
    _sub = null;
    _teamId = null;
  }
}
