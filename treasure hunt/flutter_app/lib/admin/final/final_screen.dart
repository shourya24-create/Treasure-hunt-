/// admin/final/final_screen.dart — The headset desk (GAMEPLAY.md §4.5).
///
/// One headset, first come, first served, in order of arrival at the final.
/// A club member marks a team arrived, starts their viewing, and records the
/// one decision the team tells them. This is the only way a decision enters
/// the system. The screen never shows which decision is correct.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/game.dart';
import '../../core/models/team.dart';
import '../../core/providers/admin_providers.dart';
import '../../core/providers/game_clock_provider.dart';
import '../../theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';
import '../shell/admin_actions.dart';

class FinalScreen extends StatelessWidget {
  const FinalScreen({super.key});

  Future<void> _recordDecision(BuildContext context, TeamDoc t) async {
    final decision = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('TEAM ${t.id} DECISION'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Record what the team tells you.'),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: EchoButton.destructive(
                      label: 'Destroy Echo',
                      onPressed: () => Navigator.of(dialogContext).pop('DESTROY'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: EchoButton.primary(
                      label: 'Keep Echo',
                      onPressed: () => Navigator.of(dialogContext).pop('KEEP'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        actions: [
          EchoButton.ghost(
            label: 'Cancel',
            onPressed: () => Navigator.of(dialogContext).pop(),
          ),
        ],
      ),
    );
    if (decision == null || !context.mounted) return;

    final ok = await ConfirmDialog.show(
      context,
      title: 'Confirm $decision for ${t.id}',
      consequence: 'This cannot be changed. It also stops ${t.id}\'s clock.',
      confirmLabel: 'Confirm',
      destructive: decision == 'DESTROY',
    );
    if (ok && context.mounted) {
      await runAdminAction(
        context,
        'recordDecision',
        teamId: t.id,
        decision: decision,
        done: 'Decision recorded · ${t.id} · $decision',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AdminDataProvider>();
    final now = context.watch<GameClockProvider>().now;
    final game = data.game;

    final arrived = data.teams.where((t) => t.finalArrivedAt != null).toList()
      ..sort((a, b) => a.finalArrivedAt!.compareTo(b.finalArrivedAt!));
    final notArrived = data.teams.where((t) => t.finalArrivedAt == null).toList();

    return EchoPage(
      maxWidth: 760,
      children: [
        const SectionLabel('Headset queue · first come, first served'),
        const SizedBox(height: 16),
        if (arrived.isEmpty)
          const StatusTag('No team has arrived at the final yet', status: EchoStatus.idle),
        for (var i = 0; i < arrived.length; i++) ...[
          _ArrivedRow(
            position: i + 1,
            team: arrived[i],
            game: game,
            onStartViewing: () => runAdminAction(
              context,
              'startViewing',
              teamId: arrived[i].id,
              done: 'Headset on · ${arrived[i].id}',
            ),
            onRecordDecision: () => _recordDecision(context, arrived[i]),
          ),
          const SizedBox(height: 8),
        ],
        const SizedBox(height: 32),
        const SectionLabel('Not arrived'),
        const SizedBox(height: 16),
        for (final t in notArrived) ...[
          EchoCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t.label.toUpperCase(),
                        style: EchoText.headline(size: 18, color: EchoColors.textMuted),
                      ),
                      const SizedBox(height: 4),
                      SectionLabel(teamActivity(t, game, now), color: EchoColors.textMuted),
                    ],
                  ),
                ),
                EchoButton.ghost(
                  label: 'Mark arrived',
                  // Only once the team is on its way back.
                  onPressed: readyForFinal(t, game, now)
                      ? () => runAdminAction(
                            context,
                            'arrivedFinal',
                            teamId: t.id,
                            done: 'Arrived at final · ${t.id}',
                          )
                      : null,
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _ArrivedRow extends StatelessWidget {
  const _ArrivedRow({
    required this.position,
    required this.team,
    required this.game,
    required this.onStartViewing,
    required this.onRecordDecision,
  });

  final int position;
  final TeamDoc team;
  final GameState game;
  final VoidCallback onStartViewing;
  final VoidCallback onRecordDecision;

  @override
  Widget build(BuildContext context) {
    final decided = team.decision != null;
    final inHeadset = game.inHeadset == team.id;
    final headsetBusy = game.inHeadset != null;

    final tag = decided
        ? const StatusTag('Decided', status: EchoStatus.done)
        : inHeadset
            ? const StatusTag('In headset', status: EchoStatus.live)
            : const StatusTag('Waiting', status: EchoStatus.idle);

    return EchoCard(
      raised: inHeadset,
      borderColor: inHeadset ? EchoColors.signalGreen : EchoColors.hairline,
      padding: const EdgeInsets.all(16),
      child: Wrap(
        spacing: 16,
        runSpacing: 10,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(
            position.toString().padLeft(2, '0'),
            style: EchoText.mono(size: 18, color: EchoColors.textMuted),
          ),
          SizedBox(
            width: 170,
            child: Text(
              team.label.toUpperCase(),
              style: EchoText.headline(
                size: 22,
                color: decided ? EchoColors.textSecondary : EchoColors.textHeadline,
              ),
            ),
          ),
          Text(
            'ARRIVED ${formatClock(team.finalArrivedAt!)}',
            style: EchoText.mono(size: 12, color: EchoColors.textSecondary),
          ),
          tag,
          if (decided)
            Text(
              'RECORDED ${formatClock(team.decidedAt!)}',
              style: EchoText.mono(size: 12, color: EchoColors.textSecondary),
            )
          else if (inHeadset)
            EchoButton.primary(label: 'Record decision', onPressed: onRecordDecision)
          else
            EchoButton.ghost(
              label: 'Start viewing',
              // One headset: one team at a time.
              onPressed: headsetBusy ? null : onStartViewing,
            ),
        ],
      ),
    );
  }
}
