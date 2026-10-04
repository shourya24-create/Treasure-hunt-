/// admin/map/map_screen.dart — Where every team's phone is.
///
/// Dark-tinted OpenStreetMap tiles, a pin per team coloured by status, and
/// checkpoint markers once their coordinates are filled in
/// (core/models/checkpoint.dart). Tap a pin for the team summary.
library;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../../core/models/checkpoint.dart';
import '../../core/models/game.dart';
import '../../core/models/team.dart';
import '../../core/providers/admin_providers.dart';
import '../../core/providers/game_clock_provider.dart';
import '../../theme.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';
import '../../widgets/team_chip.dart';
import '../shell/admin_actions.dart';

/// Inverts and desaturates the light OSM tiles toward bg-void.
const _darkTiles = ColorFilter.matrix(<double>[
  -0.60, -0.30, -0.10, 0, 215,
  -0.55, -0.35, -0.10, 0, 225,
  -0.55, -0.30, -0.10, 0, 205,
  0, 0, 0, 1, 0,
]);

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  String? _selected;

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AdminDataProvider>();
    final now = context.watch<GameClockProvider>().now;
    final located = data.teams.where((t) => t.location != null).toList();
    final selected = _selected == null ? null : data.team(_selected!);

    return Stack(
      children: [
        FlutterMap(
          options: MapOptions(
            initialCenter: LatLng(campusCenter.lat, campusCenter.lng),
            initialZoom: 17,
            onTap: (_, _) => setState(() => _selected = null),
          ),
          children: [
            ColorFiltered(
              colorFilter: _darkTiles,
              child: TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.flutter_app',
              ),
            ),
            MarkerLayer(
              markers: [
                for (final entry in checkpointLocations.entries)
                  if (entry.value case final point?)
                    Marker(
                      point: LatLng(point.lat, point.lng),
                      width: 56,
                      height: 28,
                      child: _CheckpointMarker(entry.key),
                    ),
                for (final t in located)
                  Marker(
                    point: LatLng(t.location!.lat, t.location!.lng),
                    width: 64,
                    // The marker bounds the pin's tap area: at least 48 px
                    // tall, so a pin can be hit on a touch screen (UI.md §8).
                    height: 48,
                    child: TeamChip(
                      t.id,
                      status: teamStatusColor(t, data, now),
                      onTap: () => setState(() => _selected = t.id),
                    ),
                  ),
              ],
            ),
          ],
        ),
        // Required by the OpenStreetMap tile usage policy. On its own surface:
        // straight on the tiles the text is lost among the street labels.
        Positioned(
          right: 8,
          bottom: 8,
          child: EchoCard(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            child: Text(
              '© OpenStreetMap contributors',
              style: EchoText.mono(size: 10, color: EchoColors.textSecondary),
            ),
          ),
        ),
        if (located.isEmpty)
          const Positioned(
            left: 16,
            top: 16,
            child: EchoCard(
              padding: EdgeInsets.all(12),
              child: StatusTag('No team has shared a position yet', status: EchoStatus.idle),
            ),
          ),
        if (selected != null)
          Positioned(
            right: 16,
            top: 16,
            width: 300,
            child: _TeamPanel(team: selected, game: data.game, now: now),
          ),
      ],
    );
  }
}

class _CheckpointMarker extends StatelessWidget {
  const _CheckpointMarker(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: EchoColors.bgVoid,
          border: Border.all(color: EchoColors.textSecondary),
        ),
        child: Text(label, style: EchoText.mono(size: 12, color: EchoColors.textPrimary)),
      );
}

class _TeamPanel extends StatelessWidget {
  const _TeamPanel({required this.team, required this.game, required this.now});
  final TeamDoc team;
  final GameState game;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final loc = team.location;
    return EchoCard(
      raised: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(team.label.toUpperCase(), style: EchoText.headline(size: 22)),
          const SizedBox(height: 8),
          SectionLabel(teamActivity(team, game, now)),
          const SizedBox(height: 12),
          Text(
            'STEP ${team.step}/7 · ${team.points} PTS',
            style: EchoText.mono(size: 13),
          ),
          if (loc != null) ...[
            const SizedBox(height: 4),
            Text(
              '±${loc.accuracy.round()}M · ${formatAgo(loc.at, now)} AGO',
              style: EchoText.mono(size: 13, color: EchoColors.textSecondary),
            ),
          ],
          const SizedBox(height: 16),
          EchoButton.ghost(
            label: 'Open team',
            onPressed: () => context.go('/admin/teams/${team.id}'),
          ),
        ],
      ),
    );
  }
}
