/// admin/setup/setup_screen.dart — Used before the event.
///
/// Teams and their phones, each team's route (generated from GAMEPLAY.md §5,
/// read-only here), and content status: everything in GAMEPLAY.md §8 that is
/// still a TODO_ placeholder shows red, delivered items dim green. Also the
/// reset that clears a rehearsal, so its clock is not still running on event day.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/route.dart';
import '../../core/providers/admin_providers.dart';
import '../../core/providers/game_clock_provider.dart';
import '../../core/services/admin_service.dart';
import '../../core/services/team_service.dart' show readableError;
import '../../theme.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';
import '../shell/admin_actions.dart';

class SetupScreen extends StatefulWidget {
  const SetupScreen({super.key});

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  List<ContentStatusItem>? _content;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadContent();
  }

  Future<void> _loadContent() async {
    try {
      final items = await context.read<AdminService>().contentStatus();
      if (mounted) setState(() => _content = items);
    } catch (e) {
      if (mounted) setState(() => _error = readableError(e));
    }
  }

  Future<void> _reopen() async {
    final ok = await ConfirmDialog.show(
      context,
      title: 'Reopen game',
      consequence: 'Undoes END GAME so teams on campus can scan and solve '
          'again. It does not extend the 2-hour clock.',
      confirmLabel: 'Reopen',
    );
    if (ok && mounted) {
      await runAdminAction(context, 'reopenGame', done: 'Campus game reopened');
    }
  }

  Future<void> _resetEvent() async {
    final ok = await TypedConfirmDialog.show(
      context,
      title: 'Reset event',
      consequence: 'Wipes every team\'s progress, logs every phone out and '
          'clears the clock. Use it after a rehearsal, never during the event.',
      word: 'RESET',
      destructive: true,
    );
    if (ok && mounted) {
      await runAdminAction(context, 'resetEvent', done: 'Event reset');
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AdminDataProvider>();
    final now = context.watch<GameClockProvider>().now;
    final content = _content;

    return EchoPage(
      maxWidth: 900,
      children: [
        // ── Teams ────────────────────────────────────────────────────────────
        SectionLabel('Teams · ${data.teams.length} / ${teamIds.length} created'),
        const SizedBox(height: 16),
        if (data.teams.length < teamIds.length) ...[
          EchoButton.primary(
            label: 'Create missing teams',
            onPressed: () => runAdminAction(context, 'seedTeams', done: 'Teams created'),
          ),
          const SizedBox(height: 8),
          Text(
            'Creates each missing team with its route. Existing teams are never '
            'overwritten.',
            style: EchoText.body(color: EchoColors.textSecondary),
          ),
          const SizedBox(height: 16),
        ],
        for (final t in data.teams) ...[
          EchoCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Wrap(
              spacing: 20,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(
                  width: 150,
                  child: Text(t.label.toUpperCase(), style: EchoText.headline(size: 18)),
                ),
                Text(
                  // CP1 first, then the campus order the route generates.
                  ['CP1', ...t.order].join(' → '),
                  style: EchoText.mono(size: 12, color: EchoColors.textSecondary),
                ),
                t.deviceUid == null
                    ? const StatusTag('No phone logged in', status: EchoStatus.idle)
                    : data.isOffline(t, now)
                        ? const StatusTag('Phone offline', status: EchoStatus.failed)
                        : const StatusTag('Phone logged in', status: EchoStatus.done),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
        const SizedBox(height: 32),

        // ── Content status ───────────────────────────────────────────────────
        const SectionLabel('Content status'),
        const SizedBox(height: 16),
        if (_error != null)
          FailureCard(_error!, onRetry: () {
            setState(() => _error = null);
            _loadContent();
          })
        else if (content == null)
          const DecryptingText(label: 'CHECKING')
        else
          for (final item in content) ...[
            EchoCard(
              borderColor: item.complete ? EchoColors.hairline : EchoColors.dangerRed,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Expanded(child: Text(item.label, style: EchoText.body())),
                  item.complete
                      ? StatusTag('Delivered ${item.total}/${item.total}', status: EchoStatus.done)
                      : StatusTag(
                          'Missing ${item.total - item.delivered}/${item.total}',
                          status: EchoStatus.failed,
                        ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
        const SizedBox(height: 8),
        Text(
          'Content lives in functions/src/content/. Paper puzzles, scan objects '
          'and the headset video are physical and are not tracked here.',
          style: EchoText.body(color: EchoColors.textSecondary),
        ),

        // ── Recovery ─────────────────────────────────────────────────────────
        if (data.game.ended) ...[
          const SizedBox(height: 32),
          const SectionLabel('Recovery'),
          const SizedBox(height: 16),
          EchoButton.ghost(label: 'Reopen game', onPressed: _reopen),
        ],

        // ── Rehearsal ────────────────────────────────────────────────────────
        const SizedBox(height: 32),
        const SectionLabel('Rehearsal'),
        const SizedBox(height: 16),
        // Left-aligned: a page-wide red bar would read as a failure.
        Align(
          alignment: Alignment.centerLeft,
          child: EchoButton.destructive(label: 'Reset event', onPressed: _resetEvent),
        ),
        const SizedBox(height: 8),
        Text(
          'START GAME in a rehearsal starts the 2-hour clock. Reset the event '
          'afterwards, or the clock will already have run out on event day.',
          style: EchoText.body(color: EchoColors.textSecondary),
        ),
      ],
    );
  }
}
