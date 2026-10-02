/// MissionCompleteView — a club member has recorded the team's decision.
///
/// Never shows which decision was correct, the points or the rank
/// (UI.md §3.4): the phone is not even sent them.
library;

import 'package:flutter/material.dart';

import '../../../theme.dart';
import '../../../widgets/echo_scaffold.dart';
import '../../../widgets/status_dot.dart';

class MissionCompleteView extends StatelessWidget {
  const MissionCompleteView({super.key});

  @override
  Widget build(BuildContext context) => EchoPage(
        children: [
          const SizedBox(height: 56),
          const StatusTag('Transmission closed', status: EchoStatus.done),
          const SizedBox(height: 16),
          Text('DECISION RECORDED', style: EchoText.headline(size: 44)),
          const SizedBox(height: 16),
          Text(
            'Your run is complete. The club will announce the results.',
            style: EchoText.body(size: 18),
          ),
        ],
      );
}
