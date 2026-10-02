/// admin/live/live_screen.dart — The admin home tab: checkpoint load + alerts.
///
/// Checkpoint load is the crowd-control view of GAMEPLAY.md §5.5: target 2
/// teams per checkpoint, 3 is a warning (amber), 4 or more is a failure (red).
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/models/game.dart';
import '../../core/models/route.dart';
import '../../core/models/team.dart';
import '../../core/providers/admin_providers.dart';
import '../../core/providers/game_clock_provider.dart';
import '../../theme.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';
import '../../widgets/team_chip.dart';
import '../shell/admin_actions.dart';

class LiveScreen extends StatelessWidget {
  const LiveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AdminDataProvider>();
    final now = context.watch<GameClockProvider>().now;
    final alerts = data.alerts(now);

    return EchoPage(
      maxWidth: 1100,
      children: [
        const SectionLabel('Checkpoint load · target 2 · never 4'),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final cp in campusCheckpoints)
              SizedBox(
                width: 240,
                child: _CheckpointTile(
                  cp: cp,
                  here: data.teamsAt(cp),
                  inbound: data.teamsInbound(cp),
                  data: data,
                  now: now,
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          'The count is teams that have scanned the checkpoint\'s object. '
          'Arrows are teams on their way there.',
          style: EchoText.body(color: EchoColors.textSecondary),
        ),
        const SizedBox(height: 40),
        const SectionLabel('Alerts'),
        const SizedBox(height: 16),
        if (alerts.isEmpty)
          const StatusTag('Nothing needs attention', status: EchoStatus.idle),
        for (final alert in alerts) ...[
          _AlertRow(alert: alert),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _CheckpointTile extends StatelessWidget {
  const _CheckpointTile({
    required this.cp,
    required this.here,
    required this.inbound,
    required this.data,
    required this.now,
  });

  final String cp;
  final List<TeamDoc> here;
  final List<TeamDoc> inbound;
  final AdminDataProvider data;
  final DateTime now;

  Widget _tile(BuildContext context, Color border, Color countColor) => EchoCard(
        borderColor: border,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(cp, style: EchoText.headline(size: 22))),
                Text(
                  '${here.length}',
                  style: EchoText.mono(size: 34, weight: FontWeight.w700, color: countColor),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final t in here)
                  TeamChip(
                    t.id,
                    status: teamStatusColor(t, data, now),
                    onTap: () => context.go('/admin/teams/${t.id}'),
                  ),
                for (final t in inbound)
                  TextButton(
                    onPressed: () => context.go('/admin/teams/${t.id}'),
                    child: Text('→ ${t.id}', style: EchoText.mono(size: 13, color: EchoColors.textMuted)),
                  ),
              ],
            ),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final count = here.length;
    if (count >= crowdLimit) {
      // Over the limit right now: red border, one flash.
      return FailureFlash(
        builder: (context, color) => _tile(context, color, EchoColors.dangerRedBright),
      );
    }
    if (count == crowdWarning) {
      return _tile(context, EchoColors.warningAmber, EchoColors.warningAmber);
    }
    return _tile(context, EchoColors.hairline, EchoColors.textPrimary);
  }
}

class _AlertRow extends StatelessWidget {
  const _AlertRow({required this.alert});
  final AdminAlert alert;

  @override
  Widget build(BuildContext context) {
    final failure = alert.level == AlertLevel.failure;
    final teamId = alert.teamId;
    final at = alert.at;

    return EchoCard(
      borderColor: failure ? EchoColors.dangerRed : EchoColors.warningAmber,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Wrap(
        spacing: 16,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          StatusDot(failure ? EchoStatus.failed : EchoStatus.warning),
          Text(
            at == null ? '--:--:--' : formatClock(at),
            style: EchoText.mono(size: 13, color: EchoColors.textSecondary),
          ),
          if (teamId != null) TeamChip(teamId),
          Text(alert.message, style: EchoText.mono(size: 13)),
          if (teamId != null)
            EchoButton.ghost(
              label: 'Open team',
              onPressed: () => context.go('/admin/teams/$teamId'),
            ),
          if (alert.isHelp && teamId != null)
            EchoButton.primary(
              label: 'Resolve',
              onPressed: () => runAdminAction(
                context,
                'resolveHelp',
                teamId: teamId,
                done: 'Help resolved · $teamId',
              ),
            ),
        ],
      ),
    );
  }
}
