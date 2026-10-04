/// admin/teams/team_detail.dart — One team: timeline, route strip, actions.
///
/// Every action that changes points, progress or the route opens a
/// ConfirmDialog first (UI.md §4.3), then goes through facilitatorAction.
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
import '../../widgets/confirm_dialog.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';
import '../shell/admin_actions.dart';

/// Admin actions already shown in the timeline through the team's own record.
const _inRecord = {
  'recordHint', 'forceComplete', 'arrivedFinal', 'startViewing', 'recordDecision',
};

class TeamDetail extends StatelessWidget {
  const TeamDetail({super.key, required this.team});
  final TeamDoc team;

  // ── timeline ─────────────────────────────────────────────────────────────────

  List<(DateTime, String)> _timeline(AdminDataProvider data) {
    final t = team;
    final events = <(DateTime, String)>[
      if (t.cp1DoneAt != null)
        (t.cp1DoneAt!, t.cp1Forced ? 'CP1 · FORCE-COMPLETED' : 'CP1 · GATE CODE ACCEPTED'),
      for (final d in t.done) ...[
        if (d.arrivedAt != null) (d.arrivedAt!, '${d.cp} · ARRIVED'),
        (d.solvedAt, d.forced ? '${d.cp} · FORCE-COMPLETED' : '${d.cp} · SOLVED'),
      ],
      if (t.arrivalCp != null && t.arrivalAt != null)
        (t.arrivalAt!, '${t.arrivalCp} · ARRIVED'),
      for (final h in t.hints) (h.at, '${h.cp} · HINT −20'),
      if (t.helpRequestedAt != null) (t.helpRequestedAt!, 'PRESSED I NEED HELP'),
      if (t.finalArrivedAt != null) (t.finalArrivedAt!, 'ARRIVED AT FINAL'),
      if (t.viewingStartedAt != null) (t.viewingStartedAt!, 'HEADSET ON'),
      if (t.decidedAt != null) (t.decidedAt!, 'DECISION · ${t.decision}'),
      for (final c in data.commands)
        // A command the server refused never happened to this team.
        if (c.teamId == t.id && c.processed && !_inRecord.contains(c.type))
          (c.at, 'ADMIN · ${c.type.toUpperCase()}${c.checkpointId == null ? '' : ' · ${c.checkpointId}'}'),
    ];
    events.sort((a, b) => a.$1.compareTo(b.$1));
    return events;
  }

  // ── actions ──────────────────────────────────────────────────────────────────

  Future<void> _recordHint(BuildContext context) async {
    final cp = await showDialog<String>(
      context: context,
      builder: (_) => _PickCheckpointDialog(
        title: 'Record hint for ${team.id}',
        consequence: 'A physical hint costs the team 20 points. Pick the '
            'checkpoint it was given at.',
        options: allCheckpoints,
        initial: team.arrivalCp ?? team.currentCheckpoint ?? allCheckpoints.last,
        confirmLabel: 'Record hint −20',
      ),
    );
    if (cp == null || !context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    final data = context.read<AdminDataProvider>();
    await runAdminAction(
      context,
      'recordHint',
      teamId: team.id,
      checkpointId: cp,
      done: 'Hint recorded · ${team.id} · $cp · −20',
      // Undo for 30 seconds, for a hint recorded against the wrong team.
      undo: SnackBarAction(
        label: 'UNDO',
        onPressed: () async {
          final error = await data.act('undoHint', teamId: team.id);
          messenger.showSnackBar(
            SnackBar(content: Text(error ?? 'HINT REMOVED · ${team.id}')),
          );
        },
      ),
    );
  }

  Future<void> _forceComplete(BuildContext context, String cp) async {
    final ok = await ConfirmDialog.show(
      context,
      title: 'Force-complete $cp',
      consequence: '${team.id} gets +100 and the next chapter, exactly like a '
          'normal solve.',
      confirmLabel: 'Force-complete',
    );
    if (ok && context.mounted) {
      await runAdminAction(
        context,
        'forceComplete',
        teamId: team.id,
        // The checkpoint the dialog named. Left out, the server completes
        // whatever is next when the call lands, so a retry would complete two.
        checkpointId: cp,
        done: 'Force-completed · ${team.id} · $cp',
      );
    }
  }

  Future<void> _swapNext(BuildContext context, String next, List<String> later) async {
    final data = context.read<AdminDataProvider>();
    final cp = await showDialog<String>(
      context: context,
      builder: (_) => _PickCheckpointDialog(
        title: 'Swap $next for ${team.id}',
        consequence: '${team.id} is sent to the checkpoint you pick now and '
            'visits $next later. Their app shows the new clue.',
        options: later,
        // Live load, so the admin does not send the team into another crowd.
        captions: {
          for (final cp in later)
            cp: '${data.teamsAt(cp).length} here · ${data.teamsInbound(cp).length} inbound',
        },
        confirmLabel: 'Swap',
      ),
    );
    if (cp == null || !context.mounted) return;
    await runAdminAction(
      context,
      'swapNext',
      teamId: team.id,
      checkpointId: cp,
      done: 'Rerouted · ${team.id} · next $cp',
    );
  }

  Future<void> _confirmed(
    BuildContext context,
    String type, {
    required String title,
    required String consequence,
    required String done,
    String? checkpointId,
    bool destructive = false,
  }) async {
    final ok = await ConfirmDialog.show(
      context,
      title: title,
      consequence: consequence,
      confirmLabel: title,
      destructive: destructive,
    );
    if (ok && context.mounted) {
      await runAdminAction(
        context,
        type,
        teamId: team.id,
        checkpointId: checkpointId,
        done: done,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AdminDataProvider>();
    final now = context.watch<GameClockProvider>().now;
    final t = team;
    final game = data.game;
    final onRoute = t.status == TeamStatus.waiting || t.status == TeamStatus.playing;
    final open = game.started && !game.closed(now);
    final current = t.currentCheckpoint;
    final next = t.nextCheckpoint;
    final later = t.remaining.skip(1).toList();
    final loc = t.location;
    final timeline = _timeline(data);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text(t.label.toUpperCase(), style: EchoText.headline(size: 28))),
            Text('${t.points} PTS', style: EchoText.mono(size: 18)),
          ],
        ),
        const SizedBox(height: 8),
        StatusTag(teamActivity(t, game, now), status: teamStatusColor(t, data, now)),
        const SizedBox(height: 8),
        Text(
          'CHECKPOINTS +${t.checkpointPoints} · HINTS −${t.hintPoints} · '
          'DECISION ${t.decision == null ? '—' : '+${t.decisionPoints}'}',
          style: EchoText.mono(size: 12, color: EchoColors.textSecondary),
        ),
        if (loc != null) ...[
          const SizedBox(height: 4),
          Text(
            'GPS ±${loc.accuracy.round()}M · ${formatAgo(loc.at, now)} AGO',
            style: EchoText.mono(size: 12, color: EchoColors.textSecondary),
          ),
        ],
        const SizedBox(height: 24),

        // ── Route strip ──────────────────────────────────────────────────────
        const SectionLabel('Route'),
        const SizedBox(height: 10),
        Row(
          children: [
            for (var i = 0; i < t.order.length; i++) ...[
              if (i > 0) const SizedBox(width: 4),
              Expanded(child: _routeSlot(t, t.order[i])),
            ],
          ],
        ),
        const SizedBox(height: 28),

        // ── Actions ──────────────────────────────────────────────────────────
        const SectionLabel('Actions'),
        const SizedBox(height: 10),
        EchoButton.primary(
          label: 'Record hint (−20)',
          onPressed: () => _recordHint(context),
        ),
        if (onRoute && current != null && open) ...[
          const SizedBox(height: 8),
          EchoButton.primary(
            label: 'Force-complete $current',
            onPressed: () => _forceComplete(context, current),
          ),
        ],
        if (onRoute && next != null && later.isNotEmpty) ...[
          const SizedBox(height: 8),
          EchoButton.ghost(
            label: 'Swap next checkpoint',
            onPressed: () => _swapNext(context, next, later),
          ),
          const SizedBox(height: 8),
          EchoButton.ghost(
            label: 'Move $next to end of route',
            onPressed: () => _confirmed(
              context,
              'moveToEnd',
              title: 'Move $next to end',
              consequence: '${t.id} skips $next for now and visits it last. Use '
                  'this when the checkpoint is broken or blocked.',
              // Named for the same reason as a force-complete: a retry must
              // not move a second checkpoint.
              checkpointId: next,
              done: 'Rerouted · ${t.id} · $next moved to end',
            ),
          ),
        ],
        if (t.helpRequestedAt != null) ...[
          const SizedBox(height: 8),
          EchoButton.ghost(
            label: 'Resolve help request',
            onPressed: () => runAdminAction(
              context,
              'resolveHelp',
              teamId: t.id,
              done: 'Help resolved · ${t.id}',
            ),
          ),
        ],
        const SizedBox(height: 8),
        EchoButton.ghost(
          label: t.paused ? 'Resume team' : 'Pause team',
          onPressed: () => _confirmed(
            context,
            t.paused ? 'resumeTeam' : 'pauseTeam',
            title: t.paused ? 'Resume ${t.id}' : 'Pause ${t.id}',
            consequence: t.paused
                ? '${t.id} can scan and solve again.'
                : '${t.id}\'s app is locked until you resume them.',
            done: t.paused ? 'Resumed · ${t.id}' : 'Paused · ${t.id}',
          ),
        ),
        if (t.deviceUid != null) ...[
          const SizedBox(height: 8),
          EchoButton.destructive(
            label: 'Release phone',
            onPressed: () => _confirmed(
              context,
              'releaseDevice',
              title: 'Release phone',
              consequence: 'Logs ${t.id}\'s phone out so they can log in on a new '
                  'one (dead battery, etc.). Their progress is kept.',
              done: 'Phone released · ${t.id}',
              destructive: true,
            ),
          ),
        ],
        if (loc != null) ...[
          const SizedBox(height: 8),
          EchoButton.ghost(
            label: 'Show on map',
            onPressed: () => context.go('/admin/map'),
          ),
        ],
        const SizedBox(height: 28),

        // ── Timeline ─────────────────────────────────────────────────────────
        const SectionLabel('Timeline'),
        const SizedBox(height: 10),
        if (timeline.isEmpty)
          const StatusTag('Nothing yet', status: EchoStatus.idle),
        for (final (at, text) in timeline)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  formatClock(at),
                  style: EchoText.mono(size: 12, color: EchoColors.textMuted),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(text, style: EchoText.mono(size: 12))),
              ],
            ),
          ),
      ],
    );
  }

  /// Done = dim green · next = bright green pulse · later = hairline.
  Widget _routeSlot(TeamDoc t, String cp) {
    final done = t.doneIds.contains(cp);
    final next = t.onCampus && t.nextCheckpoint == cp;
    final slot = Container(
      height: 34,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: done ? EchoColors.signalGreenDim : null,
        border: Border.all(
          color: done
              ? EchoColors.signalGreen
              : next
                  ? EchoColors.signalGreenBright
                  : EchoColors.hairline,
          width: next ? 1.5 : 1,
        ),
      ),
      child: Text(
        cp,
        style: EchoText.mono(
          size: 11,
          color: done || next ? EchoColors.textPrimary : EchoColors.textMuted,
        ),
      ),
    );
    return next ? Pulse(child: slot) : slot;
  }
}

/// Pick one checkpoint, read the consequence, confirm. A dialog is its own
/// screen, so the picked option may use gold.
class _PickCheckpointDialog extends StatefulWidget {
  const _PickCheckpointDialog({
    required this.title,
    required this.consequence,
    required this.options,
    required this.confirmLabel,
    this.initial,
    this.captions = const {},
  });

  final String title;
  final String consequence;
  final List<String> options;
  final String confirmLabel;
  final String? initial;

  /// Extra line under an option, e.g. its live team count.
  final Map<String, String> captions;

  @override
  State<_PickCheckpointDialog> createState() => _PickCheckpointDialogState();
}

class _PickCheckpointDialogState extends State<_PickCheckpointDialog> {
  late String? _picked =
      widget.options.contains(widget.initial) ? widget.initial : null;

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.title.toUpperCase()),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(widget.consequence),
              const SizedBox(height: 20),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final cp in widget.options)
                    EchoCard(
                      raised: _picked == cp,
                      borderColor: _picked == cp
                          ? EchoColors.highlightSelect
                          : EchoColors.hairline,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      onTap: () => setState(() => _picked = cp),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            cp,
                            style: EchoText.mono(
                              color: _picked == cp
                                  ? EchoColors.highlightSelect
                                  : EchoColors.textPrimary,
                            ),
                          ),
                          if (widget.captions[cp] case final caption?)
                            Text(
                              caption.toUpperCase(),
                              style: EchoText.mono(size: 10, color: EchoColors.textSecondary),
                            ),
                        ],
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
            onPressed: () => Navigator.of(context).pop(),
          ),
          EchoButton.primary(
            label: widget.confirmLabel,
            onPressed: _picked == null ? null : () => Navigator.of(context).pop(_picked),
          ),
        ],
      );
}
