/// core/providers/game_clock_provider.dart — One ticking clock for the whole app.
///
/// Countdowns, "last seen" ages and the 2-hour cut-off all read `now` from
/// here, so they move together and only one timer runs.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';

class GameClockProvider extends ChangeNotifier {
  GameClockProvider() {
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      _now = DateTime.now();
      notifyListeners();
    });
  }

  late final Timer _timer;
  DateTime _now = DateTime.now();

  DateTime get now => _now;

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }
}
