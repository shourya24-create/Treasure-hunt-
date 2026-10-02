/// player/mission/mission_screen.dart — The Mission tab: one view at a time.
///
/// Driven entirely by the team's Firestore view, the game state and the
/// clock, so a reload always lands on the correct view (GAMEPLAY.md §9,
/// UI.md §3.4). There is no hint button and no decision screen here on
/// purpose: hints are physical and the decision is recorded by a club member.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/game_clock_provider.dart';
import '../../core/providers/team_provider.dart';
import '../../widgets/status_dot.dart';
import 'views/final_queue_view.dart';
import 'views/game_over_view.dart';
import 'views/gate_code_view.dart';
import 'views/mission_complete_view.dart';
import 'views/objective_view.dart';
import 'views/return_to_base_view.dart';
import 'views/reward_sequence_view.dart';
import 'views/waiting_room_view.dart';

class MissionScreen extends StatelessWidget {
  const MissionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TeamProvider>();
    final now = context.watch<GameClockProvider>().now;
    final view = provider.view;
    final stage = provider.stage(now);

    if (view == null || stage == MissionStage.loading) {
      return const DecryptingText();
    }

    return switch (stage) {
      MissionStage.loading => const DecryptingText(),
      MissionStage.waitingRoom => const WaitingRoomView(),
      MissionStage.gateCode => const GateCodeView(),
      // Keyed by completion count, so each new reward starts from its first line.
      MissionStage.reward => RewardSequenceView(
          key: ValueKey(view.completions),
          reward: view.pendingReward!,
        ),
      MissionStage.objective => ObjectiveView(view: view),
      MissionStage.returnToBase => ReturnToBaseView(view: view),
      MissionStage.finalQueue => FinalQueueView(view: view, game: provider.game),
      MissionStage.complete => const MissionCompleteView(),
      MissionStage.gameOver => const GameOverView(),
    };
  }
}
