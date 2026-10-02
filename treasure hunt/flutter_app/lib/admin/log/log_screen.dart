/// admin/log/log_screen.dart — Everything that happened, newest first.
///
/// Read-only. Team events come from each team's own record (gate code,
/// arrivals, solves, final); admin events from the audit trail the
/// facilitatorAction function writes. Filter by team and by actor.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/game.dart';
import '../../core/models/team.dart';
import '../../core/providers/admin_providers.dart';
import '../../theme.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';

class _Entry {
  const _Entry({
    required this.at,
    required this.actor,
    required this.action,
    required this.byAdmin,
    this.teamId,
    this.details = '',
  });

  final DateTime at;
  final String actor;
  final String action;
  final bool byAdmin;
  final String? teamId;
  final String details;
}

List<_Entry> _teamEntries(TeamDoc t) {
  _Entry entry(DateTime at, String action, [String details = '']) => _Entry(
        at: at,
        actor: t.id,
        teamId: t.id,
        action: action,
        details: details,
        byAdmin: false,
      );

  return [
    if (t.cp1DoneAt != null && !t.cp1Forced) entry(t.cp1DoneAt!, 'GATE CODE ACCEPTED', 'CP1'),
    for (final d in t.done) ...[
      if (d.arrivedAt != null) entry(d.arrivedAt!, 'ARRIVED', d.cp),
      if (!d.forced) entry(d.solvedAt, 'SOLVED', d.cp),
    ],
    if (t.arrivalCp != null && t.arrivalAt != null) entry(t.arrivalAt!, 'ARRIVED', t.arrivalCp!),
    if (t.helpRequestedAt != null) entry(t.helpRequestedAt!, 'I NEED HELP'),
  ];
}

class LogScreen extends StatefulWidget {
  const LogScreen({super.key});

  @override
  State<LogScreen> createState() => _LogScreenState();
}

class _LogScreenState extends State<LogScreen> {
  /// Null = all teams.
  String? _team;

  /// Null = everyone, true = admin actions only, false = team actions only.
  bool? _admin;

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AdminDataProvider>();

    final entries = <_Entry>[
      for (final t in data.teams) ..._teamEntries(t),
      for (final c in data.commands)
        _Entry(
          at: c.at,
          actor: 'ADMIN',
          teamId: c.teamId,
          action: c.type.toUpperCase(),
          details: [c.teamId, c.checkpointId, c.decision].whereType<String>().join(' · '),
          byAdmin: true,
        ),
    ]
        .where((e) => _team == null || e.teamId == _team)
        .where((e) => _admin == null || e.byAdmin == _admin)
        .toList()
      ..sort((a, b) => b.at.compareTo(a.at));

    return EchoPage(
      maxWidth: 900,
      children: [
        const SectionLabel('Log · newest first'),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _Filter(label: 'Everyone', active: _admin == null, onTap: () => setState(() => _admin = null)),
            _Filter(label: 'Teams', active: _admin == false, onTap: () => setState(() => _admin = false)),
            _Filter(label: 'Admins', active: _admin == true, onTap: () => setState(() => _admin = true)),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _Filter(label: 'All teams', active: _team == null, onTap: () => setState(() => _team = null)),
            for (final t in data.teams)
              _Filter(label: t.id, active: _team == t.id, onTap: () => setState(() => _team = t.id)),
          ],
        ),
        const SizedBox(height: 20),
        if (entries.isEmpty) const StatusTag('Nothing logged yet', status: EchoStatus.idle),
        for (final e in entries)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 84,
                  child: Text(formatClock(e.at), style: EchoText.mono(size: 12, color: EchoColors.textMuted)),
                ),
                SizedBox(
                  width: 64,
                  child: Text(e.actor, style: EchoText.mono(size: 12, color: EchoColors.textSecondary)),
                ),
                Expanded(
                  child: Text(
                    e.details.isEmpty ? e.action : '${e.action} · ${e.details}',
                    style: EchoText.mono(size: 12),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// A filter toggle. Active = raised surface with a green border; gold stays
/// with the active nav item.
class _Filter extends StatelessWidget {
  const _Filter({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => EchoCard(
        raised: active,
        borderColor: active ? EchoColors.signalGreen : EchoColors.hairline,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        onTap: onTap,
        child: Text(
          label.toUpperCase(),
          style: EchoText.mono(
            size: 12,
            color: active ? EchoColors.textPrimary : EchoColors.textSecondary,
          ),
        ),
      );
}
