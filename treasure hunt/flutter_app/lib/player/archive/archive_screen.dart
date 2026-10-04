/// player/archive/archive_screen.dart — The Archive Log: every fragment recovered so far.
///
/// One entry per cleared fragment, in the order the team cleared them: when
/// it was recovered, the Echo chapter it unlocked (replayable, with its
/// transcript), the station's reaction, and the clue and scan target that led
/// there. An entry only repeats what the team was already shown, so the log
/// never reveals the route ahead (GAMEPLAY.md §4.7).
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/chapter.dart';
import '../../core/models/game.dart';
import '../../core/models/team.dart';
import '../../core/providers/team_provider.dart';
import '../../theme.dart';
import '../../widgets/chapter_player.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';

class ArchiveScreen extends StatefulWidget {
  const ArchiveScreen({super.key});

  @override
  State<ArchiveScreen> createState() => _ArchiveScreenState();
}

class _ArchiveScreenState extends State<ArchiveScreen> {
  /// Entries the team has opened or closed by hand. The newest entry is open
  /// until they say otherwise.
  final Map<int, bool> _toggled = {};

  /// The entry whose voice line is playing right now.
  int? _playing;

  @override
  Widget build(BuildContext context) {
    final view = context.watch<TeamProvider>().view;
    if (view == null) return const DecryptingText();
    final entries = view.archive;

    return EchoPage(
      children: [
        Row(
          children: [
            const Expanded(child: SectionLabel('Archive log')),
            Text(
              '${entries.length} / ${TeamView.totalCheckpoints} ENTRIES',
              style: EchoText.mono(size: 13, color: EchoColors.textSecondary),
            ),
          ],
        ),
        const SizedBox(height: 20),
        if (entries.isEmpty)
          const _EmptyLog()
        else
          for (final entry in entries) ...[
            _EntryCard(
              entry: entry,
              open: _toggled[entry.n] ?? entry.n == entries.last.n,
              playing: _playing == entry.n,
              onToggle: (open) => setState(() => _toggled[entry.n] = open),
              onPlayingChanged: (playing) => setState(() {
                if (playing) {
                  _playing = entry.n;
                } else if (_playing == entry.n) {
                  _playing = null;
                }
              }),
            ),
            const SizedBox(height: 12),
          ],
      ],
    );
  }
}

class _EmptyLog extends StatelessWidget {
  const _EmptyLog();

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          border: Border.all(color: EchoColors.hairline),
          borderRadius: const BorderRadius.all(Radius.circular(2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'NOTHING RECOVERED YET',
              style: EchoText.headline(size: 18, color: EchoColors.textMuted),
            ),
            const SizedBox(height: 8),
            Text(
              'Each fragment you recover is saved here with what Echo said.',
              style: EchoText.body(color: EchoColors.textSecondary),
            ),
          ],
        ),
      );
}

class _EntryCard extends StatelessWidget {
  const _EntryCard({
    required this.entry,
    required this.open,
    required this.playing,
    required this.onToggle,
    required this.onPlayingChanged,
  });

  final ArchiveEntry entry;
  final bool open;
  final bool playing;
  final ValueChanged<bool> onToggle;
  final ValueChanged<bool> onPlayingChanged;

  @override
  Widget build(BuildContext context) {
    final at = entry.clearedAt;
    final chapter = entry.chapter;
    final reaction = entry.stationReaction;
    final clue = entry.locationClue;
    final hint = entry.objectHint;
    final hasImage = hint != null && !isPlaceholder(hint.imageUrl);

    return EchoCard(
      raised: open || playing,
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Header: always visible, opens and closes the entry ─────────────
          Semantics(
            button: true,
            expanded: open,
            child: InkWell(
              onTap: () => onToggle(!open),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 12, 16),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('FRAGMENT ${entry.n}', style: EchoText.headline(size: 22)),
                          const SizedBox(height: 6),
                          playing
                              ? const StatusTag('Playing', status: EchoStatus.live)
                              : StatusTag(
                                  at == null
                                      ? 'Recovered'
                                      : 'Recovered ${formatShortClock(at)}',
                                  status: EchoStatus.done,
                                ),
                        ],
                      ),
                    ),
                    Icon(
                      open ? Icons.expand_less : Icons.expand_more,
                      color: EchoColors.textMuted,
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Kept in the tree while closed, so a playing chapter is not cut off.
          Offstage(
            offstage: !open,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── The story this fragment unlocked ───────────────────────
                  SectionLabel('Chapter ${chapter.n} · ${chapter.title}'),
                  const SizedBox(height: 12),
                  // No autoPlay: a chapter is downloaded when the team taps
                  // play, not when its card appears, so opening the Archive
                  // costs no mobile data.
                  ChapterPlayer(
                    key: ValueKey(chapter.n),
                    audioUrl: chapter.audioUrl,
                    transcript: chapter.transcript,
                    onPlayingChanged: onPlayingChanged,
                  ),

                  if (reaction != null && reaction.text.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    const SectionLabel('Station reaction'),
                    const SizedBox(height: 8),
                    Text(reaction.text, style: EchoText.body()),
                  ],

                  if (clue != null || hint != null) ...[
                    const SizedBox(height: 20),
                    const Divider(height: 1, color: EchoColors.hairline),
                    const SizedBox(height: 20),
                  ],
                  if (clue != null) ...[
                    const SectionLabel('Clue you solved'),
                    const SizedBox(height: 8),
                    Text(clue, style: EchoText.body(color: EchoColors.textSecondary)),
                    if (hint != null) const SizedBox(height: 20),
                  ],
                  if (hint != null) ...[
                    const SectionLabel('Scan target'),
                    const SizedBox(height: 8),
                    if (hasImage) ...[
                      DecoratedBox(
                        decoration: BoxDecoration(
                          border: Border.all(color: EchoColors.hairline),
                        ),
                        child: Image.network(
                          hint.imageUrl,
                          height: 160,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => const SizedBox.shrink(),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                    Text(hint.text, style: EchoText.body(color: EchoColors.textSecondary)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
