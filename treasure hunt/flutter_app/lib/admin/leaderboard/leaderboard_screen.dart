/// admin/leaderboard/leaderboard_screen.dart — Ranking with the full breakdown.
///
/// Order follows GAMEPLAY.md §6: highest total, then the earlier finish time.
/// Projector mode is for the room: no admin chrome, and the decision bonus
/// stays SEALED until the admin presses REVEAL, so the correct decision is
/// not given away while teams are still deciding.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/models/game.dart';
import '../../core/models/team.dart';
import '../../core/providers/admin_providers.dart';
import '../../theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';

List<TeamDoc> _ranked(List<TeamDoc> teams, {required bool sealed}) =>
    [...teams]..sort((a, b) => compareForLeaderboard(a, b, sealed: sealed));

String _finish(TeamDoc t) => t.decidedAt == null ? '—' : formatClock(t.decidedAt!);

class LeaderboardScreen extends StatelessWidget {
  const LeaderboardScreen({super.key});

  Future<void> _exportCsv(BuildContext context, List<TeamDoc> ranked) async {
    final lines = [
      'rank,team,name,checkpoints,hints,decision_bonus,total,decision,finish_time',
      for (var i = 0; i < ranked.length; i++)
        [
          i + 1,
          ranked[i].id,
          '"${ranked[i].name.replaceAll('"', '""')}"',
          ranked[i].checkpointPoints,
          -ranked[i].hintPoints,
          ranked[i].decisionPoints,
          ranked[i].points,
          ranked[i].decision ?? '',
          _finish(ranked[i]),
        ].join(','),
    ];
    await Clipboard.setData(ClipboardData(text: lines.join('\n')));
    if (context.mounted) {
      showEchoNotice(context, 'CSV copied — paste it into a spreadsheet');
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AdminDataProvider>();
    final ranked = _ranked(data.teams, sealed: false);

    return EchoPage(
      maxWidth: 1000,
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            const SectionLabel('Leaderboard · points, then earlier finish time'),
            EchoButton.primary(
              label: 'Projector mode',
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => const Dialog.fullscreen(child: _Projector()),
              ),
            ),
            EchoButton.ghost(
              label: 'Export CSV',
              onPressed: () => _exportCsv(context, ranked),
            ),
          ],
        ),
        const SizedBox(height: 20),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            columns: [
              for (final label in const [
                'Rank', 'Team', 'Checkpoints', 'Hints', 'Decision bonus',
                'Total', 'Finish time',
              ])
                DataColumn(label: Text(label.toUpperCase())),
            ],
            rows: [
              for (var i = 0; i < ranked.length; i++)
                DataRow(
                  cells: [
                    DataCell(Text('${i + 1}'.padLeft(2, '0'))),
                    DataCell(Text(ranked[i].label)),
                    DataCell(Text('+${ranked[i].checkpointPoints}')),
                    DataCell(Text('−${ranked[i].hintPoints}')),
                    DataCell(Text(ranked[i].decision == null ? '—' : '+${ranked[i].decisionPoints}')),
                    DataCell(
                      Text(
                        '${ranked[i].points}',
                        style: EchoText.mono(weight: FontWeight.w700, color: EchoColors.textHeadline),
                      ),
                    ),
                    DataCell(Text(_finish(ranked[i]))),
                  ],
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Full screen, scan-lines, large Oswald type, no admin chrome.
class _Projector extends StatefulWidget {
  const _Projector();

  @override
  State<_Projector> createState() => _ProjectorState();
}

class _ProjectorState extends State<_Projector> {
  bool _sealed = true;

  Future<void> _reveal() async {
    final ok = await ConfirmDialog.show(
      context,
      title: 'Reveal decision bonus',
      consequence: 'Shows on the projector which teams earned the +100 bonus, '
          'and re-ranks them. Do this only after every team has decided.',
      confirmLabel: 'Reveal',
    );
    if (ok && mounted) setState(() => _sealed = false);
  }

  @override
  Widget build(BuildContext context) {
    final teams = context.watch<AdminDataProvider>().teams;
    final ranked = _ranked(teams, sealed: _sealed);

    return EchoScaffold(
      scanlines: true,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(40, 28, 40, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('THE ECHO PROTOCOL', style: EchoText.headline(size: 44)),
                  ),
                  if (_sealed) EchoButton.primary(label: 'Reveal', onPressed: _reveal),
                  const SizedBox(width: 12),
                  EchoButton.ghost(
                    label: 'Close',
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Expanded(
                child: ListView(
                  children: [
                    for (var i = 0; i < ranked.length; i++)
                      _ProjectorRow(rank: i + 1, team: ranked[i], sealed: _sealed),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProjectorRow extends StatelessWidget {
  const _ProjectorRow({required this.rank, required this.team, required this.sealed});
  final int rank;
  final TeamDoc team;
  final bool sealed;

  @override
  Widget build(BuildContext context) {
    final total = team.points - (sealed ? team.decisionPoints : 0);
    final bonus = team.decision == null
        ? '—'
        : sealed
            ? 'SEALED'
            : '+${team.decisionPoints}';

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: EchoColors.hairline)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 72,
            child: Text(
              rank.toString().padLeft(2, '0'),
              style: EchoText.mono(size: 26, color: EchoColors.textMuted),
            ),
          ),
          Expanded(
            child: Text(team.label.toUpperCase(), style: EchoText.headline(size: 34)),
          ),
          SizedBox(
            width: 170,
            child: Text(
              'BONUS $bonus',
              style: EchoText.mono(size: 16, color: EchoColors.textSecondary),
            ),
          ),
          SizedBox(
            width: 150,
            child: Text(
              _finish(team),
              style: EchoText.mono(size: 18, color: EchoColors.textSecondary),
            ),
          ),
          SizedBox(
            width: 110,
            child: Text(
              '$total',
              textAlign: TextAlign.right,
              style: EchoText.mono(size: 34, weight: FontWeight.w700, color: EchoColors.textHeadline),
            ),
          ),
        ],
      ),
    );
  }
}
