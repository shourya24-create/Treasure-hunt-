/// player/shell/open_scanner.dart — Hands the phone over to the scanner.
///
/// Same-origin navigation: Flutter at / and the scanner at /field/scan.
/// `_self` reuses the Firebase anonymous session (UI.md §5). A matching scan
/// brings the team back to the Fragments tab, where the fragment is solved.
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../widgets/confirm_dialog.dart';

Future<void> openScanner(BuildContext context) async {
  final launched = await launchUrl(Uri.parse('/field/scan'), webOnlyWindowName: '_self');
  if (!launched && context.mounted) {
    showEchoNotice(context, 'Could not open the scanner', failed: true);
  }
}
