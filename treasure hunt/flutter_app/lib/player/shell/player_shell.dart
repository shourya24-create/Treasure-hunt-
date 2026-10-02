/// player/shell/player_shell.dart — Player frame: top bar, the 3 tabs, bottom nav.
///
/// The active tab is the screen's one gold element. The Gate Code and Reward
/// views are "focus mode": the nav is hidden so nothing competes with them
/// (UI.md §3.4). A pause from the admin covers everything.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/game_clock_provider.dart';
import '../../core/providers/team_provider.dart';
import '../../theme.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/status_dot.dart';
import 'player_top_bar.dart';

/// Mission views that get the scan-line hero treatment.
const _heroStages = {
  MissionStage.waitingRoom,
  MissionStage.reward,
  MissionStage.returnToBase,
  MissionStage.complete,
  MissionStage.gameOver,
};

/// Mission views that hide the bottom nav.
const _focusStages = {MissionStage.gateCode, MissionStage.reward};

class PlayerShell extends StatelessWidget {
  const PlayerShell({super.key, required this.navigationShell});
  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TeamProvider>();
    final now = context.watch<GameClockProvider>().now;
    final stage = provider.stage(now);
    final onMission = navigationShell.currentIndex == 0;

    final scaffold = EchoScaffold(
      scanlines: onMission && _heroStages.contains(stage),
      body: SafeArea(
        child: Column(
          children: [
            const PlayerTopBar(),
            Expanded(child: navigationShell),
          ],
        ),
      ),
      bottomNavigationBar: onMission && _focusStages.contains(stage)
          ? null
          : NavigationBar(
              selectedIndex: navigationShell.currentIndex,
              onDestinationSelected: (index) => navigationShell.goBranch(
                index,
                initialLocation: index == navigationShell.currentIndex,
              ),
              destinations: const [
                NavigationDestination(icon: Icon(Icons.radar), label: 'MISSION'),
                NavigationDestination(icon: Icon(Icons.description_outlined), label: 'JOURNAL'),
                NavigationDestination(icon: Icon(Icons.groups_outlined), label: 'TEAM'),
              ],
            ),
    );

    if (!provider.paused) return scaffold;
    return Stack(
      children: [
        scaffold,
        const Positioned.fill(child: _PausedOverlay()),
      ],
    );
  }
}

/// Paused by admin: everything disabled until the game resumes.
class _PausedOverlay extends StatelessWidget {
  const _PausedOverlay();

  @override
  Widget build(BuildContext context) => AbsorbPointer(
        child: Material(
          color: EchoColors.bgVoid.withValues(alpha: 0.92),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const StatusDot.warning(size: 14),
                  const SizedBox(height: 20),
                  // Held, not failed: amber.
                  Text(
                    'TRANSMISSION PAUSED',
                    textAlign: TextAlign.center,
                    style: EchoText.headline(size: 32, color: EchoColors.warningAmber),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'A club member has paused the game. Stay where you are.',
                    textAlign: TextAlign.center,
                    style: EchoText.body(),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
}
