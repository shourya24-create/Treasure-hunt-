/// ReturnToBaseView — all 7 campus checkpoints are done; the team walks back
/// to the starting room for the final (GAMEPLAY.md §4.3 step 5).
library;

import 'package:flutter/material.dart';

import '../../../core/models/team.dart';
import '../../../theme.dart';
import '../../../widgets/echo_scaffold.dart';
import '../../../widgets/fragment_tracker.dart';
import '../../../widgets/status_dot.dart';

class ReturnToBaseView extends StatelessWidget {
  const ReturnToBaseView({super.key, required this.view});
  final TeamView view;

  @override
  Widget build(BuildContext context) => EchoPage(
        children: [
          FragmentTracker(done: view.completions, showCurrent: false),
          const SizedBox(height: 56),
          const StatusTag('All signals recovered', status: EchoStatus.done),
          const SizedBox(height: 16),
          Text('RETURN TO BASE', style: EchoText.headline(size: 44)),
          const SizedBox(height: 16),
          Text(
            'Walk back to the starting room. Echo has one more message for you.',
            style: EchoText.body(size: 18),
          ),
        ],
      );
}
