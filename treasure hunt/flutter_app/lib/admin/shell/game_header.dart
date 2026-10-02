/// admin/shell/game_header.dart — The header on every admin tab (UI.md §4.1).
///
///   ECHO PROTOCOL · CONTROL   01:12:44   WAITING 0 · PLAYING 9 · FINAL 2 · DONE 1
///                                        ⚠ 3   [START] [END]
///
/// START GAME and END GAME affect every team, so both need a typed confirmation.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/team.dart';
import '../../core/providers/admin_providers.dart';
import '../../core/providers/game_clock_provider.dart';
import '../../theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/countdown_bar.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/status_dot.dart';
import 'admin_actions.dart';

class GameHeader extends StatelessWidget {
  const GameHeader({super.key});

  Future<void> _start(BuildContext context) async {
    final ok = await TypedConfirmDialog.show(
      context,
      title: 'Start game',
      consequence: 'Starts the 2-hour clock for every team and unlocks CP1. '
          'Press it when the briefing begins.',
      word: 'START',
    );
    if (ok && context.mounted) {
      await runAdminAction(context, 'startGame', done: 'Game started');
    }
  }

  Future<void> _end(BuildContext context) async {
    final ok = await TypedConfirmDialog.show(
      context,
      title: 'End game',
      consequence: 'Stops all scans and solves for every team. Teams keep their '
          'points, return to base and still do the final.',
      word: 'END',
      destructive: true,
    );
    if (ok && context.mounted) {
      await runAdminAction(context, 'endGame', done: 'Campus game ended');
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AdminDataProvider>();
    final session = context.watch<AdminSessionProvider>();
    final now = context.watch<GameClockProvider>().now;
    final game = data.game;
    final closed = game.closed(now);

    int count(TeamStatus s) => data.teams.where((t) => t.status == s).length;
    final alerts = data.alerts(now);
    final failures = alerts.where((a) => a.level == AlertLevel.failure).length;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
      decoration: const BoxDecoration(
        color: EchoColors.bgSurface,
        border: Border(bottom: BorderSide(color: EchoColors.hairline)),
      ),
      child: Wrap(
        spacing: 24,
        runSpacing: 12,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text('ECHO PROTOCOL · CONTROL', style: EchoText.headline(size: 20)),
          SizedBox(width: 260, child: CountdownBar(game: game)),
          Text(
            'WAITING ${count(TeamStatus.waiting)} · '
            'PLAYING ${count(TeamStatus.playing)} · '
            'FINAL ${count(TeamStatus.atFinal)} · '
            'DONE ${count(TeamStatus.finished)}',
            style: EchoText.mono(size: 13, color: EchoColors.textSecondary),
          ),
          if (alerts.isNotEmpty)
            StatusTag(
              '${alerts.length} alert${alerts.length == 1 ? '' : 's'}',
              status: failures > 0 ? EchoStatus.failed : EchoStatus.warning,
            ),
          if (game.paused) const StatusTag('Everyone paused', status: EchoStatus.warning),
          if (closed) const StatusTag('Campus closed', status: EchoStatus.done),
          if (session.isAdmin) ...[
            if (!game.started)
              EchoButton.primary(label: 'Start game', onPressed: () => _start(context)),
            if (game.started && !closed) ...[
              EchoButton.ghost(
                label: game.paused ? 'Resume all' : 'Pause all',
                onPressed: () => runAdminAction(
                  context,
                  game.paused ? 'resumeAll' : 'pauseAll',
                  done: game.paused ? 'Everyone resumed' : 'Everyone paused',
                ),
              ),
              EchoButton.destructive(label: 'End game', onPressed: () => _end(context)),
            ],
          ],
        ],
      ),
    );
  }
}
