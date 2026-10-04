/// player/shell/player_shell.dart — Player frame: top bar, the tabs, bottom bar.
///
/// Four tabs (Home, Fragments, Archive, Profile) and the SCAN action in the
/// middle (UI.md §3.1). Before the admin starts the game only Home and
/// Profile open. The Gate Code and Reward views are "focus mode": they cover
/// every tab and hide the bar, so nothing competes with them (UI.md §3.4).
/// A pause from the admin covers everything.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/game_clock_provider.dart';
import '../../core/providers/team_provider.dart';
import '../../theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/status_dot.dart';
import '../mission/views/gate_code_view.dart';
import '../mission/views/reward_sequence_view.dart';
import 'field_app.dart';
import 'player_nav_bar.dart';
import 'player_top_bar.dart';

/// Home states that get the scan-line hero treatment.
const _heroStages = {
  MissionStage.waitingRoom,
  MissionStage.returnToBase,
  MissionStage.complete,
  MissionStage.gameOver,
};

/// Why SCAN is dimmed at this stage, or null when the scanner may open.
String? _scanLockedReason(MissionStage stage) => switch (stage) {
      MissionStage.objective => null,
      MissionStage.loading || MissionStage.waitingRoom => 'Scanner unlocks when the game starts',
      MissionStage.gateCode => 'Enter your access code first',
      MissionStage.reward => 'Listen to Echo first',
      MissionStage.gameOver => 'Campus signal closed',
      MissionStage.returnToBase ||
      MissionStage.finalQueue ||
      MissionStage.complete =>
        'Nothing left to scan',
    };

class PlayerShell extends StatelessWidget {
  const PlayerShell({super.key, required this.navigationShell});
  final StatefulNavigationShell navigationShell;

  static const _lockedTab = 'Unlocks when the game starts';

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TeamProvider>();
    final now = context.watch<GameClockProvider>().now;
    final stage = provider.stage(now);
    final view = provider.view;
    final onHome = navigationShell.currentIndex == 0;
    final started = provider.game.started;

    // Focus mode: one thing to do, on every tab.
    final Widget? focus = switch (stage) {
      MissionStage.gateCode => const GateCodeView(),
      // Keyed by completion count, so each new reward starts from its first line.
      MissionStage.reward when view?.pendingReward != null => RewardSequenceView(
          key: ValueKey(view!.completions),
          reward: view.pendingReward!,
        ),
      _ => null,
    };

    final scaffold = EchoScaffold(
      scanlines: stage == MissionStage.reward || (onHome && _heroStages.contains(stage)),
      body: SafeArea(
        child: Column(
          children: [
            const PlayerTopBar(),
            // Its own semantics container: otherwise the tab navigators
            // inside block the top bar from screen readers.
            Expanded(
              child: Semantics(
                container: true,
                explicitChildNodes: true,
                child: focus ?? navigationShell,
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: focus != null
          ? null
          : PlayerNavBar(
              currentIndex: navigationShell.currentIndex,
              items: [
                const PlayerNavItem(label: 'Home', icon: Icons.home_outlined),
                PlayerNavItem(
                  label: 'Fragments',
                  icon: Icons.grid_view_outlined,
                  lockedReason: started ? null : _lockedTab,
                ),
                PlayerNavItem(
                  label: 'Archive',
                  icon: Icons.inventory_2_outlined,
                  lockedReason: started ? null : _lockedTab,
                ),
                const PlayerNavItem(label: 'Profile', icon: Icons.person_outline),
              ],
              onSelected: (index) => navigationShell.goBranch(
                index,
                initialLocation: index == navigationShell.currentIndex,
              ),
              scanLockedReason: _scanLockedReason(stage),
              onScan: () => openFieldApp(context, activeCheckpoint: view?.activeCheckpoint),
              onLocked: (reason) => showEchoNotice(
                context,
                reason,
                duration: const Duration(seconds: 2),
              ),
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
