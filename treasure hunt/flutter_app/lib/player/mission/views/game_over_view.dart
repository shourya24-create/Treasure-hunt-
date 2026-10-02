/// GameOverView — the 2-hour mark has passed and this team's decision is not
/// recorded yet (GAMEPLAY.md §4.6).
///
/// One red flash, then static. The team keeps its points, returns to the room
/// and still does the final; this becomes the queue view once they are marked
/// as arrived.
library;

import 'package:flutter/material.dart';

import '../../../theme.dart';
import '../../../widgets/echo_scaffold.dart';
import '../../../widgets/status_dot.dart';

class GameOverView extends StatelessWidget {
  const GameOverView({super.key});

  @override
  Widget build(BuildContext context) => EchoPage(
        children: [
          const SizedBox(height: 56),
          const StatusTag('Campus signal closed', status: EchoStatus.failed),
          const SizedBox(height: 16),
          FailureFlash(
            builder: (context, color) => Text(
              'TIME\'S UP',
              style: EchoText.headline(size: 52, color: color),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Return to the starting room. You keep what you have earned, and '
            'you still make the final decision.',
            style: EchoText.body(size: 18),
          ),
        ],
      );
}
