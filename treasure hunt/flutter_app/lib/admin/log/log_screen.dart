/// admin/log/log_screen.dart — Everything that happened, newest first.
///
/// Read-only. Team events come from each team's own record (gate code,
/// arrivals, solves, final); admin events from the audit trail the
/// facilitatorAction function writes. Filter by team and by action type.
///
/// The audit trail also holds the commands the server refused. They stay in
/// the log, marked REFUSED, so nobody reads them as something that happened.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/game.dart';
import '../../core/models/team.dart';
import '../../core/providers/admin_providers.dart';
import '../../core/providers/game_clock_provider.dart';
import '../../core/services/admin_service.dart';
import '../../theme.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';

/// An audit entry is written before its action runs and marked processed once
/// the action has gone through, so a command that is still running looks just
/// like one the server refused. Only past this age is it called refused.
const _refusedAfter = Duration(seconds: 10);

/// What became of an admin command. Team events are always `done`.
enum _Outcome { done, running, refused }

_Outcome _outcomeOf(AdminCommand c, DateTime now) {
  if (c.processed) return _Outcome.done;
  return now.difference(c.at) > _refusedAfter ? _Outcome.refused : _Outcome.running;
}

class _Entry {
  const _Entry({
    required this.at,
    required this.actor,
    required this.action,
    this.teamId,
    this.details = '',
    this.outcome = _Outcome.done,
  });

  final DateTime at;
  final String actor;
  final String action;
  final String? teamId;
  final String details;
  final _Outcome outcome;
}

List<_Entry> _teamEntries(TeamDoc t) {
  _Entry entry(DateTime at, String action, [String details = '']) => _Entry(
        at: at,
        actor: t.id,
        teamId: t.id,
        action: action,
        details: details,
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

  /// Null = every action type, otherwise the `action` of the entries to show.
  String? _action;

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AdminDataProvider>();
    final now = context.watch<GameClockProvider>().now;

    final all = <_Entry>[
      for (final t in data.teams) ..._teamEntries(t),
      for (final c in data.commands)
        _Entry(
          at: c.at,
          actor: 'ADMIN',
          teamId: c.teamId,
          action: c.type.toUpperCase(),
          details: [c.teamId, c.checkpointId, c.decision].whereType<String>().join(' · '),
          outcome: _outcomeOf(c, now),
        ),
    ];

    // Only the action types that are in the log are offered. If the chosen
    // one is no longer among them (a reset wipes the team events), show all.
    final actions = {for (final e in all) e.action}.toList()..sort();
    final action = actions.contains(_action) ? _action : null;

    final entries = all
        .where((e) => _team == null || e.teamId == _team)
        .where((e) => action == null || e.action == action)
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
            _Filter(label: 'All teams', active: _team == null, onTap: () => setState(() => _team = null)),
            for (final t in data.teams)
              _Filter(label: t.id, active: _team == t.id, onTap: () => setState(() => _team = t.id)),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _Filter(label: 'All actions', active: action == null, onTap: () => setState(() => _action = null)),
            for (final a in actions)
              _Filter(label: a, active: action == a, onTap: () => setState(() => _action = a)),
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
                    [
                      e.action,
                      if (e.details.isNotEmpty) e.details,
                      if (e.outcome == _Outcome.refused) 'REFUSED',
                    ].join(' · '),
                    // Muted until it has taken effect, and for good if it never does.
                    style: EchoText.mono(
                      size: 12,
                      color: e.outcome == _Outcome.done
                          ? EchoColors.textPrimary
                          : EchoColors.textMuted,
                    ),
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
