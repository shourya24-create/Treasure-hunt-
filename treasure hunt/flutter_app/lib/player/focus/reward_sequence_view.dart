/// RewardSequenceView — right after the gate code or any solve, in order:
/// station reaction (skipped after CP1) → Echo chapter → next objective.
///
/// The reaction is looked up by checkpoint, the chapter by step (GAMEPLAY.md
/// §3). The first playback cannot be skipped: CONTINUE appears when the audio
/// ends. Finishing acknowledges the chapter just played to the server, so a
/// reload never replays it; the tabs then come back with the next fragment open.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/chapter.dart';
import '../../core/providers/team_provider.dart';
import '../../core/services/backend_call.dart' show readableError;
import '../../theme.dart';
import '../../widgets/chapter_player.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';

class RewardSequenceView extends StatefulWidget {
  const RewardSequenceView({super.key, required this.reward});
  final PendingReward reward;

  @override
  State<RewardSequenceView> createState() => _RewardSequenceViewState();
}

class _RewardSequenceViewState extends State<RewardSequenceView> {
  /// The station reaction plays first, when there is one.
  late bool _onReaction = widget.reward.stationReaction != null;
  bool _lineDone = false;
  bool _sending = false;
  String? _error;

  void _toChapter() => setState(() {
        _onReaction = false;
        _lineDone = false;
      });

  Future<void> _finish() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      // Names the chapter just played, so a completion that lands at the same
      // moment (an admin force-complete, say) is not marked as played unseen.
      await context.read<TeamProvider>().ackReward(widget.reward.chapter.n);
      // The view stream now clears pendingReward and the tabs come back.
    } catch (e) {
      if (mounted) setState(() => _error = readableError(e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reaction = widget.reward.stationReaction;
    final chapter = widget.reward.chapter;

    return EchoPage(
      children: [
        const SizedBox(height: 24),
        if (_onReaction && reaction != null) ...[
          const StatusTag('Station signal', status: EchoStatus.live),
          const SizedBox(height: 20),
          ChapterPlayer(
            key: const ValueKey('reaction'),
            audioUrl: reaction.audioUrl,
            transcript: reaction.text,
            autoPlay: true,
            transcriptOpen: true,
            onCompleted: () => setState(() => _lineDone = true),
          ),
          const SizedBox(height: 32),
          if (_lineDone) EchoButton.primary(label: 'Continue', onPressed: _toChapter),
        ] else ...[
          SectionLabel('Echo · Chapter ${chapter.n}'),
          const SizedBox(height: 16),
          Text(chapter.title.toUpperCase(), style: EchoText.headline(size: 34)),
          const SizedBox(height: 24),
          ChapterPlayer(
            key: const ValueKey('chapter'),
            audioUrl: chapter.audioUrl,
            transcript: chapter.transcript,
            autoPlay: true,
            transcriptOpen: true,
            onCompleted: () => setState(() => _lineDone = true),
          ),
          const SizedBox(height: 32),
          if (_error != null) ...[
            FailureCard(_error!, onRetry: _finish),
            const SizedBox(height: 16),
          ],
          if (_sending)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: DecryptingText(),
            )
          else if (_lineDone && _error == null)
            EchoButton.primary(label: 'Continue', onPressed: _finish),
        ],
      ],
    );
  }
}
