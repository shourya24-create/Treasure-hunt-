/// admin/teams/teams_screen.dart — All 12 teams in one sortable table.
///
/// Selecting a row opens the team detail: a side panel on a wide screen, the
/// full page on a narrow one. The selected row is a raised surface with a
/// green marker — never gold, which belongs to the active nav item.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/models/game.dart';
import '../../core/models/team.dart';
import '../../core/providers/admin_providers.dart';
import '../../core/providers/game_clock_provider.dart';
import '../../theme.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';
import '../shell/admin_actions.dart';
import 'team_detail.dart';

class TeamsScreen extends StatefulWidget {
  const TeamsScreen({super.key, this.selectedId});

  /// From `/admin/teams/:id`.
  final String? selectedId;

  @override
  State<TeamsScreen> createState() => _TeamsScreenState();
}

class _TeamsScreenState extends State<TeamsScreen> {
  int _sortColumn = 0;
  bool _ascending = true;

  /// One comparable value per column, in the order of the table header.
  List<Comparable<dynamic>> _keys(TeamDoc t) => [
        t.number,
        t.step,
        t.nextCheckpoint ?? '',
        t.points,
        t.hints.length,
        t.lastProgressAt?.millisecondsSinceEpoch ?? 0,
        t.lastSeenAt?.millisecondsSinceEpoch ?? 0,
        t.status.index,
      ];

  void _sort(int column, bool ascending) => setState(() {
        _sortColumn = column;
        _ascending = ascending;
      });

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AdminDataProvider>();
    final now = context.watch<GameClockProvider>().now;
    final selected = widget.selectedId == null ? null : data.team(widget.selectedId!);
    final wide = MediaQuery.sizeOf(context).width >= 1200;

    // Narrow: the detail takes the whole page.
    if (selected != null && !wide) {
      return EchoPage(
        maxWidth: 640,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: EchoButton.ghost(
              label: 'All teams',
              icon: Icons.arrow_back,
              onPressed: () => context.go('/admin/teams'),
            ),
          ),
          const SizedBox(height: 20),
          TeamDetail(team: selected),
        ],
      );
    }

    final teams = [...data.teams]..sort((a, b) {
        final result = Comparable.compare(
          _keys(a)[_sortColumn],
          _keys(b)[_sortColumn],
        );
        return _ascending ? result : -result;
      });

    final table = SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('Teams'),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              sortColumnIndex: _sortColumn,
              sortAscending: _ascending,
              showCheckboxColumn: false,
              columns: [
                for (final label in const [
                  'Team', 'Step', 'Next CP', 'Points', 'Hints',
                  'Last activity', 'Phone', 'Status',
                ])
                  DataColumn(label: Text(label.toUpperCase()), onSort: _sort),
              ],
              rows: [
                for (final t in teams)
                  _row(context, t, data, now, selected: t.id == selected?.id),
              ],
            ),
          ),
        ],
      ),
    );

    if (!wide || selected == null) return table;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: table),
        const VerticalDivider(width: 1),
        SizedBox(
          width: 440,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: TeamDetail(team: selected),
          ),
        ),
      ],
    );
  }

  DataRow _row(
    BuildContext context,
    TeamDoc t,
    AdminDataProvider data,
    DateTime now, {
    required bool selected,
  }) {
    final offline = data.isOffline(t, now);
    return DataRow(
      selected: selected,
      color: WidgetStatePropertyAll(
        selected ? EchoColors.bgSurfaceRaised : EchoColors.bgSurface,
      ),
      onSelectChanged: (_) => context.go('/admin/teams/${t.id}'),
      cells: [
        DataCell(
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // The green marker stands in for a row border.
              Container(
                width: 3,
                height: 28,
                color: selected ? EchoColors.signalGreen : Colors.transparent,
              ),
              const SizedBox(width: 10),
              Text(t.label),
            ],
          ),
        ),
        DataCell(Text('${t.step}/7')),
        DataCell(Text(t.cp1Done ? (t.nextCheckpoint ?? 'BASE') : 'CP1')),
        DataCell(Text('${t.points}')),
        DataCell(Text('${t.hints.length}')),
        DataCell(Text(formatAgo(t.lastProgressAt, now))),
        DataCell(
          t.deviceUid == null
              ? const StatusTag('No phone', status: EchoStatus.idle)
              : offline
                  ? StatusTag('Offline ${formatAgo(t.lastSeenAt, now)}', status: EchoStatus.failed)
                  : const StatusTag('Online', status: EchoStatus.live),
        ),
        DataCell(
          StatusTag(
            teamActivity(t, data.game, now),
            status: teamStatusColor(t, data, now),
          ),
        ),
      ],
    );
  }
}
