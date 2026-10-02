/// player/shell/player_top_bar.dart — The bar on every player tab (UI.md §3.2).
///
///   T5 · TEAM NAME          ● LIVE   ◉ GPS
///   01:12:44  ▓▓▓▓▓▓░░░░░░   3 / 8
///
/// Never shown here: points, the route, checkpoint names.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/team.dart';
import '../../core/providers/team_provider.dart';
import '../../core/services/location_service.dart';
import '../../theme.dart';
import '../../widgets/countdown_bar.dart';
import '../../widgets/signal_banner.dart';
import '../../widgets/status_dot.dart';

class PlayerTopBar extends StatelessWidget {
  const PlayerTopBar({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TeamProvider>();
    final view = provider.view;
    if (view == null) return const SizedBox.shrink();

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          decoration: const BoxDecoration(
            color: EchoColors.bgSurface,
            border: Border(bottom: BorderSide(color: EchoColors.hairline)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      view.label.toUpperCase(),
                      overflow: TextOverflow.ellipsis,
                      style: EchoText.mono(size: 13, color: EchoColors.textSecondary),
                    ),
                  ),
                  provider.online
                      ? const StatusTag('Live', status: EchoStatus.live)
                      : const StatusTag('Offline', status: EchoStatus.failed),
                  const SizedBox(width: 16),
                  ValueListenableBuilder<GpsState>(
                    valueListenable: context.read<LocationService>().gps,
                    builder: (context, gps, _) => switch (gps) {
                      GpsState.sharing => const StatusTag('GPS', status: EchoStatus.live),
                      GpsState.weak ||
                      GpsState.unknown =>
                        const StatusTag('GPS weak', status: EchoStatus.warning),
                      GpsState.off => const StatusTag('GPS off', status: EchoStatus.failed),
                    },
                  ),
                ],
              ),
              const SizedBox(height: 10),
              CountdownBar(
                game: provider.game,
                trailing: Text(
                  '${view.completions} / ${TeamView.totalCheckpoints}',
                  style: EchoText.mono(size: 13, color: EchoColors.textSecondary),
                ),
              ),
            ],
          ),
        ),
        SignalBanner(online: provider.online),
      ],
    );
  }
}
