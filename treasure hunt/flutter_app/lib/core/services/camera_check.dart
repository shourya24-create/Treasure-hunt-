/// core/services/camera_check.dart — Asks the browser for camera access.
///
/// The scanner at /field/scan needs the camera. Asking here, before lights-off,
/// means the permission prompt is already answered when the team first scans.
/// Web only, like the rest of this app.
library;

// ignore: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:html' as html;

/// Returns true if the browser granted camera access. The camera is released
/// again straight away.
Future<bool> requestCameraAccess() async {
  try {
    final stream = await html.window.navigator.mediaDevices
        ?.getUserMedia({'video': true});
    if (stream == null) return false;
    for (final track in stream.getTracks()) {
      track.stop();
    }
    return true;
  } catch (_) {
    return false;
  }
}
