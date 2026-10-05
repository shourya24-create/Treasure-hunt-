/// player/fragments/fragments_screen.dart — The Fragments tab: all 8, one open.
///
/// Fragments are numbered 1–8 by order of completion, never by checkpoint, so
/// the list cannot reveal the route (UI.md §3.6). Only the open one shows
/// anything: its location clue, the object to scan, and the way into the
/// scanner. Once the scan has matched, the same card unlocks and becomes the
/// place the fragment is solved. The clue and hint belong to the team's next
/// checkpoint, which the server picks from its route; the app never learns
/// the route or the checkpoint's ID. Straight after CP1 there is no clue,
/// because the paper already named the place (GAMEPLAY.md §4.2).
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/models/chapter.dart' show isPlaceholder;
import '../../core/models/game.dart';
import '../../core/models/team.dart';
import '../../core/providers/game_clock_provider.dart';
import '../../core/providers/team_provider.dart';
import '../../core/services/backend_call.dart' show readableError;
import '../../theme.dart';
import '../../widgets/code_field.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/fragment_tracker.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';
import '../shell/open_scanner.dart';

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
              StatusTag(arrived ? 'Unlocked' : 'Open', status: EchoStatus.live),
            ],
          ),
          const SizedBox(height: 18),
          if (arrived)
            // The scan matched: the fragment is unlocked to solve. Keyed by
            // fragment, so a new one starts with an empty answer.
            _SolvePanel(key: ValueKey(n))
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
            const SizedBox(height: 22),
            EchoButton.primary(
              label: 'Scan',
              icon: Icons.center_focus_strong,
              onPressed: () => openScanner(context),
            ),
          ],
        ],
      ),
    );
  }
}

/// Where an unlocked fragment is solved.
///
/// TODO(story/AR team): this is the logic only. Each fragment's real puzzle
/// replaces the placeholder text below; whatever it is, it ends by handing
/// its result to `TeamProvider.submitAnswer`, which the server grades
/// against content/answers.ts. A wrong answer may be retried freely.
class _SolvePanel extends StatefulWidget {
  const _SolvePanel({super.key});

  @override
  State<_SolvePanel> createState() => _SolvePanelState();
}

class _SolvePanelState extends State<_SolvePanel> {
  final _answerCtrl = TextEditingController();
  bool _sending = false;
  String? _error;

  /// Bumped on every failure so the red flash plays again.
  int _attempt = 0;

  @override
  void dispose() {
    _answerCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final answer = _answerCtrl.text.trim();
    if (answer.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final correct = await context.read<TeamProvider>().submitAnswer(answer);
      if (!mounted) return;
      // On success the view stream plays Echo's chapter by itself.
      if (!correct) _fail('Not correct. Try again');
    } catch (e) {
      if (mounted) _fail(readableError(e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _fail(String message) => setState(() {
        _error = message;
        _attempt++;
      });

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Your scan matched. Solve this fragment to recover it.',
            style: EchoText.body(size: 17),
          ),
          const SizedBox(height: 20),
          const SectionLabel('Puzzle'),
          const SizedBox(height: 8),
          Text(
            'The puzzle for this fragment has not been added yet.',
            style: EchoText.body(color: EchoColors.textSecondary),
          ),
          const SizedBox(height: 20),
          const SectionLabel('Your answer'),
          const SizedBox(height: 10),
          CodeField(
            key: ValueKey(_attempt),
            controller: _answerCtrl,
            hint: 'ANSWER',
            large: false,
            failed: _error != null,
            enabled: !_sending,
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: 14),
          if (_error != null) ...[
            StatusTag(_error!, status: EchoStatus.failed),
            const SizedBox(height: 14),
          ],
          if (_sending)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: DecryptingText(label: 'CHECKING'),
            )
          else
            EchoButton.primary(label: 'Submit', onPressed: _submit),
        ],
      );
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
