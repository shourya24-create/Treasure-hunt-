/// FinalQueueView — the team has been marked "arrived at final" and waits for
/// the one headset, first come, first served (GAMEPLAY.md §4.5).
///
/// Shows the live queue position. There is no decision screen: the team tells
/// the club member, who records it in the admin panel.
library;

import 'package:flutter/material.dart';

import '../../../core/models/game.dart';
import '../../../core/models/team.dart';
import '../../../theme.dart';
import '../../../widgets/echo_scaffold.dart';
import '../../../widgets/section_label.dart';
import '../../../widgets/status_dot.dart';

class FinalQueueView extends StatelessWidget {
  const FinalQueueView({super.key, required this.view, required this.game});
  final TeamView view;
  final GameState game;

  @override
  Widget build(BuildContext context) {
    final position = game.finalQueue.indexOf(view.id) + 1;
    final yourTurn = game.inHeadset == view.id;

    return EchoPage(
      children: [
        const SizedBox(height: 40),
        const SectionLabel('Final'),
        const SizedBox(height: 16),
        Text(
          yourTurn ? 'YOUR TURN' : 'HEADSET QUEUE',
          style: EchoText.headline(size: 40),
        ),
        const SizedBox(height: 32),
        if (yourTurn)
          const StatusTag('Headset ready for your team', status: EchoStatus.live)
        else
          Center(
            child: Text(
              position > 0 ? '#$position' : '#—',
              style: EchoText.mono(size: 96, weight: FontWeight.w700, spacing: 0),
            ),
          ),
        const SizedBox(height: 32),
        Text(
          yourTurn
              ? 'One member of your team puts the headset on and watches '
                  'Echo\'s message. Then decide together and tell the club '
                  'member. Your clock stops when they record it.'
              : 'Report to the club member at the headset desk. Waiting time '
                  'counts, so stay close.',
          style: EchoText.body(),
        ),
      ],
    );
  }
}
