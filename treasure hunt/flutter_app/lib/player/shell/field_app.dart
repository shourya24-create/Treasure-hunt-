/// player/shell/field_app.dart — Hands the phone over to the AR field app.
///
/// Same-origin navigation: Flutter at / and the field app at /field/.
/// `_self` reuses the Firebase anonymous session (UI.md §5).
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../widgets/confirm_dialog.dart';

/// Opens the scanner, or the AR activity of `activeCheckpoint` once the scan
/// object has matched.
Future<void> openFieldApp(BuildContext context, {String? activeCheckpoint}) async {
  final uri = Uri.parse(
    activeCheckpoint == null ? '/field/scan' : '/field/activity?cp=$activeCheckpoint',
  );
  final launched = await launchUrl(uri, webOnlyWindowName: '_self');
  if (!launched && context.mounted) {
    showEchoNotice(context, 'Could not open the scanner', failed: true);
  }
}
