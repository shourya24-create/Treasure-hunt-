/// ObjectiveView — the home screen in play: where to go and what to scan.
///
/// The location clue and object hint belong to the team's next checkpoint,
/// which the server picks from its route; the app never learns the route or
/// the checkpoint's ID. Straight after CP1 there is no clue, because the
/// paper already named the place (GAMEPLAY.md §4.2).
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/models/chapter.dart' show isPlaceholder;
import '../../../core/models/team.dart';
import '../../../theme.dart';
import '../../../widgets/confirm_dialog.dart';
import '../../../widgets/echo_button.dart';
import '../../../widgets/echo_card.dart';
import '../../../widgets/echo_scaffold.dart';
import '../../../widgets/fragment_tracker.dart';
import '../../../widgets/section_label.dart';
import '../../../widgets/status_dot.dart';

class ObjectiveView extends StatelessWidget {
  const ObjectiveView({super.key, required this.view});
  final TeamView view;

  /// Same-origin navigation: Flutter at / and the field app at /field/.
  /// `_self` reuses the Firebase anonymous session (UI.md §5).
  Future<void> _openFieldApp(BuildContext context) async {
    final active = view.activeCheckpoint;
    final uri = Uri.parse(
      active == null ? '/field/scan' : '/field/activity?cp=$active',
    );
    final launched = await launchUrl(uri, webOnlyWindowName: '_self');
    if (!launched && context.mounted) {
      showEchoNotice(context, 'Could not open the scanner', failed: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hint = view.objectHint;
    final hasImage = hint != null && !isPlaceholder(hint.imageUrl);
    final arrived = view.activeCheckpoint != null;

    return EchoPage(
      children: [
        FragmentTracker(done: view.completions),
        const SizedBox(height: 32),
        const SectionLabel('Current objective'),
        const SizedBox(height: 12),

        if (arrived) ...[
          // The scan matched: the checkpoint's AR activity is open.
          EchoCard(
            raised: true,
            borderColor: EchoColors.signalGreen,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const StatusTag('Signal locked', status: EchoStatus.live),
                const SizedBox(height: 12),
                Text(
                  'You are in the right place. Finish the activity here to '
                  'recover the signal.',
                  style: EchoText.body(),
                ),
              ],
            ),
          ),
        ] else ...[
          EchoCard(
            child: Text(
              view.locationClue ?? 'Go to the location from your paper.',
              style: EchoText.body(size: 18),
            ),
          ),
          if (hint != null) ...[
            const SizedBox(height: 12),
            EchoCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionLabel('Scan target'),
                  const SizedBox(height: 12),
                  if (hasImage) ...[
                    DecoratedBox(
                      decoration: BoxDecoration(
                        border: Border.all(color: EchoColors.hairline),
                      ),
                      child: Image.network(
                        hint.imageUrl,
                        height: 220,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  Text(hint.text, style: EchoText.body()),
                ],
              ),
            ),
          ],
        ],

        const SizedBox(height: 28),
        EchoButton.primary(
          label: arrived ? 'Resume activity' : 'Scan',
          icon: arrived ? null : Icons.center_focus_strong,
          onPressed: () => _openFieldApp(context),
        ),
      ],
    );
  }
}
