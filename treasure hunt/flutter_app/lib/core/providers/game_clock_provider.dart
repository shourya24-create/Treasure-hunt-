/// core/providers/game_clock_provider.dart — One ticking clock for the whole app.
///
/// Countdowns, "last seen" ages and the 2-hour cut-off all read `now` from
/// here, so they move together and only one timer runs.
///
/// `now` follows the server's clock, not the device's. The game's start time
/// is stamped by the server, so a phone whose own clock is fast or slow would
/// otherwise show TIME'S UP too early or too late.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';

class GameClockProvider extends ChangeNotifier {
  GameClockProvider() {
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  late final Timer _timer;

  /// Server time minus this device's time. Zero until the server has answered.
  Duration _offset = Duration.zero;
  DateTime _now = DateTime.now();

  DateTime get now => _now;

  /// Called with the server's time whenever a response carries it.
  void syncWithServer(DateTime serverNow) {
    _offset = serverNow.difference(DateTime.now());
    _tick();
  }

  void _tick() {
    _now = DateTime.now().add(_offset);
    notifyListeners();
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }
}
