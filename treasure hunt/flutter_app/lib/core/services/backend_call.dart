/// core/services/backend_call.dart — How the app calls the game's backend.
///
/// Shared by the team and admin services. Every call has a 10-second timeout,
/// so a network hang does not leave the UI frozen indefinitely.
library;

import 'dart:async';

import 'package:cloud_functions/cloud_functions.dart';

/// Where the callables live when they are not on Cloud Functions: build with
/// `--dart-define=API_BASE=/api` for the Vercel deployment, where the same
/// functions are served from this site's own `/api/<name>`. Empty means
/// Cloud Functions (or the emulator).
const _apiBase = String.fromEnvironment('API_BASE');

/// Calls a backend function with a 10-second timeout and returns its result map.
Future<Map<String, dynamic>> callFunction(
  FirebaseFunctions functions,
  String name,
  Map<String, dynamic> data,
) async {
  final callable = _apiBase.isEmpty
      ? functions.httpsCallable(name)
      : functions.httpsCallableFromUrl(Uri.base.resolve('$_apiBase/$name').toString());
  final result = await callable.call<dynamic>(data).timeout(
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
