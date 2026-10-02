/// WaitingRoomView — before CP1 opens: the team is in the room, listening
/// to the live briefing (GAMEPLAY.md §4.1–4.2).
library;

import 'package:flutter/material.dart';

import '../../../theme.dart';
import '../../../widgets/echo_scaffold.dart';
import '../../../widgets/section_label.dart';
import '../../../widgets/status_dot.dart';

class WaitingRoomView extends StatelessWidget {
  const WaitingRoomView({super.key});

  @override
  Widget build(BuildContext context) => EchoPage(
        children: [
          const SizedBox(height: 48),
          const SectionLabel('CP1 locked'),
          const SizedBox(height: 16),
          Text('LISTEN TO THE BRIEFING', style: EchoText.headline(size: 40)),
          const SizedBox(height: 40),
          // A slowly pulsing signal glyph: the channel is open, nothing yet.
          const Center(
            child: Pulse(
              child: Icon(
                Icons.sensors,
                size: 96,
                color: EchoColors.signalGreenBright,
              ),
            ),
          ),
          const SizedBox(height: 40),
          Text(
            'Keep this phone with your team. It is the only one that can play '
            'for you.',
            style: EchoText.body(color: EchoColors.textSecondary),
          ),
        ],
      );
}
