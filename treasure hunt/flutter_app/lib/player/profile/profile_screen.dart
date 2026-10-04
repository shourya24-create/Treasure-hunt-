/// player/profile/profile_screen.dart — The Profile tab: who we are, this phone, and help.
///
/// A team plays on one shared login, so the profile is the team's. No points
/// and no leaderboard here (UI.md §3.7).
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/game.dart';
import '../../core/models/team.dart';
import '../../core/providers/game_clock_provider.dart';
import '../../core/providers/team_provider.dart';
import '../../core/services/location_service.dart';
import '../../core/services/team_service.dart' show readableError;
import '../../theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _requestHelp(BuildContext context) async {
    final ok = await ConfirmDialog.show(
      context,
      title: 'I need help',
      consequence: 'This alerts the club with your position. Use it if you are '
          'lost, hurt or stuck.',
      confirmLabel: 'Send alert',
    );
    if (!ok || !context.mounted) return;
    try {
      await context.read<TeamProvider>().requestHelp();
    } catch (e) {
      if (context.mounted) showEchoNotice(context, readableError(e), failed: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TeamProvider>();
    final now = context.watch<GameClockProvider>().now;
    final view = provider.view;
    if (view == null) return const DecryptingText();

    // The team's clock stops when its decision is recorded.
    final elapsed = provider.game.elapsed(view.decidedAt ?? now);
    final help = view.helpRequestedAt;

    return EchoPage(
      children: [
        const SectionLabel('Profile'),
        const SizedBox(height: 12),
        Text(view.name.toUpperCase(), style: EchoText.headline(size: 34)),
        const SizedBox(height: 24),
        EchoCard(
          child: Column(
            children: [
              _Line(label: 'Team ID', value: view.id),
              const SizedBox(height: 12),
              _Line(label: 'Team name', value: view.name),
              const SizedBox(height: 12),
              _Line(
                label: 'Fragments recovered',
                value: '${view.completions} / ${TeamView.totalCheckpoints}',
              ),
              const SizedBox(height: 12),
              _Line(
                label: 'Elapsed',
                value: provider.game.started ? formatDuration(elapsed) : '--:--:--',
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        // ── This phone ───────────────────────────────────────────────────────
        const SectionLabel('This phone'),
        const SizedBox(height: 12),
        EchoCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              provider.online
                  ? const StatusTag('Connected', status: EchoStatus.live)
                  : const StatusTag('Offline · retrying', status: EchoStatus.failed),
              const SizedBox(height: 14),
              ValueListenableBuilder<GpsState>(
                valueListenable: context.read<LocationService>().gps,
                builder: (context, gps, _) => switch (gps) {
                  GpsState.sharing =>
                    const StatusTag('Sharing location', status: EchoStatus.live),
                  GpsState.weak ||
                  GpsState.unknown =>
                    const StatusTag('Location signal weak', status: EchoStatus.warning),
                  GpsState.off => const StatusTag(
                      'Location off — allow it for this site',
                      status: EchoStatus.failed,
                    ),
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        // ── Help ─────────────────────────────────────────────────────────────
        if (help == null)
          EchoButton.ghost(
            label: 'I need help',
            onPressed: () => _requestHelp(context),
          )
        else
          EchoCard(
            child: Text(
              'HELP REQUESTED AT ${formatShortClock(help)}',
              style: EchoText.mono(),
            ),
          ),
      ],
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          SectionLabel(label),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              overflow: TextOverflow.ellipsis,
              style: EchoText.mono(size: 16),
            ),
          ),
        ],
      );
}
