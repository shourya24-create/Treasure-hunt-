/// player/fragments/fragments_screen.dart — The Fragments tab: all 8, one open.
///
/// Fragments are numbered 1–8 by order of completion, never by checkpoint, so
/// the list cannot reveal the route (UI.md §3.3). Only the open one shows
/// anything: its location clue, the object to scan, and the way into the
/// scanner. The clue and hint belong to the team's next checkpoint, which the
/// server picks from its route; the app never learns the route or the
/// checkpoint's ID. Straight after CP1 there is no clue, because the paper
/// already named the place (GAMEPLAY.md §4.2).
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/models/chapter.dart' show isPlaceholder;
import '../../core/models/game.dart';
import '../../core/models/team.dart';
import '../../core/providers/game_clock_provider.dart';
import '../../core/providers/team_provider.dart';
import '../../theme.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/fragment_tracker.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';
import '../shell/field_app.dart';

class FragmentsScreen extends StatelessWidget {
  const FragmentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TeamProvider>();
    final now = context.watch<GameClockProvider>().now;
    final view = provider.view;
    if (view == null) return const DecryptingText();

    final stage = provider.stage(now);
    final done = view.completions;
    // The fragment being chased right now, if any.
    final open = stage == MissionStage.objective ? done + 1 : null;
    // Once the campus game is over, what is left can no longer be recovered.
    final closed = stage == MissionStage.gameOver ||
        stage == MissionStage.finalQueue ||
        stage == MissionStage.complete;
    final cleared = {for (final entry in view.archive) entry.n: entry};

    return EchoPage(
      children: [
        Row(
          children: [
            const Expanded(child: SectionLabel('Fragments')),
            Text(
              '$done / ${TeamView.totalCheckpoints} RECOVERED',
              style: EchoText.mono(size: 13, color: EchoColors.textSecondary),
            ),
          ],
        ),
        const SizedBox(height: 14),
        FragmentTracker(done: done, showCurrent: open != null),
        const SizedBox(height: 24),
        for (var n = 1; n <= TeamView.totalCheckpoints; n++) ...[
          if (n <= done)
            _ClearedRow(
              n: n,
              entry: cleared[n],
              onTap: () => context.go('/archive'),
            )
          else if (n == open)
            _OpenCard(n: n, view: view)
          else
            _LockedRow(n: n, closed: closed),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

/// A recovered fragment: its story is in the Archive.
class _ClearedRow extends StatelessWidget {
  const _ClearedRow({required this.n, required this.entry, required this.onTap});

  final int n;
  final ArchiveEntry? entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final at = entry?.clearedAt;
    return EchoCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('FRAGMENT $n', style: EchoText.headline(size: 20)),
                const SizedBox(height: 6),
                const StatusTag('Recovered', status: EchoStatus.done),
              ],
            ),
          ),
          if (at != null)
            Text(
              formatShortClock(at),
              style: EchoText.mono(size: 13, color: EchoColors.textSecondary),
            ),
          const SizedBox(width: 8),
          const Icon(Icons.chevron_right, color: EchoColors.textMuted),
        ],
      ),
    );
  }
}

/// The fragment in play: where to go, what to scan, and the scanner.
class _OpenCard extends StatelessWidget {
  const _OpenCard({required this.n, required this.view});

  final int n;
  final TeamView view;

  @override
  Widget build(BuildContext context) {
    final hint = view.objectHint;
    final hasImage = hint != null && !isPlaceholder(hint.imageUrl);
    final arrived = view.activeCheckpoint != null;

    return EchoCard(
      raised: true,
      borderColor: EchoColors.signalGreenBright,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text('FRAGMENT $n', style: EchoText.headline(size: 24))),
              StatusTag(arrived ? 'Signal locked' : 'Open', status: EchoStatus.live),
            ],
          ),
          const SizedBox(height: 18),
          if (arrived)
            // The scan matched: the checkpoint's AR activity is open.
            Text(
              'You are in the right place. Finish the activity here to '
              'recover this fragment.',
              style: EchoText.body(size: 17),
            )
          else ...[
            const SectionLabel('Where to go'),
            const SizedBox(height: 8),
            Text(
              view.locationClue ?? 'Go to the location from your paper.',
              style: EchoText.body(size: 18),
            ),
            if (hint != null) ...[
              const SizedBox(height: 20),
              const SectionLabel('Scan target'),
              const SizedBox(height: 10),
              if (hasImage) ...[
                DecoratedBox(
                  decoration: BoxDecoration(
                    border: Border.all(color: EchoColors.hairline),
                  ),
                  child: Image.network(
                    hint.imageUrl,
                    height: 220,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              Text(hint.text, style: EchoText.body()),
            ],
          ],
          const SizedBox(height: 22),
          EchoButton.primary(
            label: arrived ? 'Resume activity' : 'Scan',
            icon: arrived ? null : Icons.center_focus_strong,
            onPressed: () => openFieldApp(context, activeCheckpoint: view.activeCheckpoint),
          ),
        ],
      ),
    );
  }
}

/// A fragment that is still ahead, or one the team ran out of time for.
class _LockedRow extends StatelessWidget {
  const _LockedRow({required this.n, required this.closed});

  final int n;
  final bool closed;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        decoration: BoxDecoration(
          border: Border.all(color: EchoColors.hairline),
          borderRadius: const BorderRadius.all(Radius.circular(2)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                'FRAGMENT $n · ${closed ? 'NOT RECOVERED' : 'ENCRYPTED'}',
                style: EchoText.headline(size: 18, color: EchoColors.textMuted),
              ),
            ),
            if (!closed) const Icon(Icons.lock_outline, size: 18, color: EchoColors.textMuted),
          ],
        ),
      );
}
