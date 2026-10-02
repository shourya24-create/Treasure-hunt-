/// player/journal/journal_screen.dart — Chapters 1–8 in chapter order.
///
/// Unlocked chapters can be replayed; locked ones show only "ENCRYPTED".
/// Never shows checkpoint names, places or the route (GAMEPLAY.md §4.7) —
/// the team view does not even contain them.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/chapter.dart';
import '../../core/providers/team_provider.dart';
import '../../theme.dart';
import '../../widgets/chapter_player.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';

class JournalScreen extends StatefulWidget {
  const JournalScreen({super.key});

  @override
  State<JournalScreen> createState() => _JournalScreenState();
}

class _JournalScreenState extends State<JournalScreen> {
  /// The chapter whose voice line is playing right now.
  int? _playing;

  @override
  Widget build(BuildContext context) {
    final unlocked = {
      for (final c in context.watch<TeamProvider>().view?.chapters ?? const <ChapterView>[])
        c.n: c,
    };

    return EchoPage(
      children: [
        const SectionLabel('Echo transmissions'),
        const SizedBox(height: 20),
        for (var n = 1; n <= ChapterView.total; n++) ...[
          if (unlocked[n] case final chapter?)
            _UnlockedCard(
              chapter: chapter,
              playing: _playing == n,
              onPlayingChanged: (playing) => setState(() {
                if (playing) {
                  _playing = n;
                } else if (_playing == n) {
                  _playing = null;
                }
              }),
            )
          else
            _LockedCard(n: n),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _UnlockedCard extends StatelessWidget {
  const _UnlockedCard({
    required this.chapter,
    required this.playing,
    required this.onPlayingChanged,
  });

  final ChapterView chapter;
  final bool playing;
  final ValueChanged<bool> onPlayingChanged;

  @override
  Widget build(BuildContext context) => EchoCard(
        raised: playing,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('CHAPTER ${chapter.n}', style: EchoText.headline(size: 22)),
                ),
                playing
                    ? const StatusTag('Playing', status: EchoStatus.live)
                    : const StatusTag('Received', status: EchoStatus.done),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              chapter.title.toUpperCase(),
              style: EchoText.label(color: EchoColors.textSecondary),
            ),
            const SizedBox(height: 16),
            ChapterPlayer(
              key: ValueKey(chapter.n),
              audioUrl: chapter.audioUrl,
              transcript: chapter.transcript,
              onPlayingChanged: onPlayingChanged,
            ),
          ],
        ),
      );
}

class _LockedCard extends StatelessWidget {
  const _LockedCard({required this.n});
  final int n;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          border: Border.all(color: EchoColors.hairline),
          borderRadius: const BorderRadius.all(Radius.circular(2)),
        ),
        child: Text(
          'CHAPTER $n · ENCRYPTED',
          style: EchoText.headline(size: 18, color: EchoColors.textMuted),
        ),
      );
}
