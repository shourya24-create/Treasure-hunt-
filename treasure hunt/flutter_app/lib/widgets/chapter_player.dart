/// widgets/chapter_player.dart — Plays a voice line: play/pause, progress, transcript.
///
/// Used for Echo's chapters (keyed by step) and for station reactions. Every
/// line has a transcript, since campuses are noisy (UI.md §8). If the audio is
/// not delivered yet or fails to load, the transcript opens and playback
/// counts as finished, so a team is never stuck behind a missing file.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../core/models/chapter.dart';
import '../core/models/game.dart';
import '../theme.dart';
import 'status_dot.dart';

class ChapterPlayer extends StatefulWidget {
  const ChapterPlayer({
    super.key,
    required this.audioUrl,
    required this.transcript,
    this.autoPlay = false,
    this.transcriptOpen = false,
    this.onCompleted,
    this.onPlayingChanged,
  });

  final String audioUrl;
  final String transcript;

  /// Start as soon as the widget appears (a fresh unlock).
  final bool autoPlay;
  final bool transcriptOpen;

  /// Called once, when the line has played to the end (or cannot be played).
  final VoidCallback? onCompleted;
  final ValueChanged<bool>? onPlayingChanged;

  @override
  State<ChapterPlayer> createState() => _ChapterPlayerState();
}

class _ChapterPlayerState extends State<ChapterPlayer> {
  final AudioPlayer _player = AudioPlayer();
  final List<StreamSubscription<dynamic>> _subs = [];

  bool _ready = false;
  bool _unavailable = false;
  bool _playing = false;
  bool _completed = false;
  Duration _position = Duration.zero;
  Duration? _duration;
  late bool _transcriptOpen = widget.transcriptOpen;

  @override
  void initState() {
    super.initState();
    _subs.add(_player.playerStateStream.listen(_onState));
    _subs.add(_player.positionStream.listen((p) {
      if (mounted) setState(() => _position = p);
    }));
    if (isPlaceholder(widget.audioUrl)) {
      // Not delivered yet: nothing to load, the transcript stands in.
      _unavailable = true;
      _transcriptOpen = true;
      _complete();
    } else {
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final duration = await _player.setUrl(widget.audioUrl);
      if (!mounted) return;
      setState(() {
        _ready = true;
        _duration = duration;
      });
      // Browsers may block audio that was not started by a tap; the play
      // button still works if this is refused.
      if (widget.autoPlay) await _player.play();
    } catch (_) {
      _markUnavailable();
    }
  }

  void _markUnavailable() {
    if (!mounted) return;
    setState(() {
      _unavailable = true;
      _transcriptOpen = true;
    });
    _complete();
  }

  void _onState(PlayerState state) {
    if (!mounted) return;
    final playing = state.playing && state.processingState != ProcessingState.completed;
    if (playing != _playing) {
      setState(() => _playing = playing);
      widget.onPlayingChanged?.call(playing);
    }
    if (state.processingState == ProcessingState.completed) _complete();
  }

  void _complete() {
    if (_completed) return;
    _completed = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onCompleted?.call();
    });
  }

  Future<void> _toggle() async {
    try {
      if (_playing) {
        await _player.pause();
      } else {
        if (_player.processingState == ProcessingState.completed) {
          await _player.seek(Duration.zero);
        }
        await _player.play();
      }
    } catch (_) {
      _markUnavailable();
    }
  }

  @override
  void dispose() {
    for (final sub in _subs) {
      sub.cancel();
    }
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = _duration;
    final fraction = total == null || total.inMilliseconds == 0
        ? 0.0
        : (_position.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0).toDouble();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_unavailable)
          const StatusTag('Voice line not loaded — read the transcript', status: EchoStatus.idle)
        else
          Row(
            children: [
              SizedBox(
                width: 48,
                height: 48,
                child: OutlinedButton(
                  style: EchoButtonStyles.ghost.copyWith(
                    padding: const WidgetStatePropertyAll(EdgeInsets.zero),
                  ),
                  onPressed: _ready ? _toggle : null,
                  child: Icon(_playing ? Icons.pause : Icons.play_arrow, size: 22),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                // Playback position is a measurement, so amber.
                child: Container(
                  height: 6,
                  decoration: BoxDecoration(border: Border.all(color: EchoColors.hairline)),
                  child: FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: fraction,
                    child: const ColoredBox(color: EchoColors.warningAmber),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(
                total == null ? '--:--' : formatDuration(total).substring(3),
                style: EchoText.mono(size: 12, color: EchoColors.textSecondary),
              ),
            ],
          ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => setState(() => _transcriptOpen = !_transcriptOpen),
            child: Text(_transcriptOpen ? 'TRANSCRIPT ▲' : 'TRANSCRIPT ▼'),
          ),
        ),
        if (_transcriptOpen) ...[
          const SizedBox(height: 4),
          Text(widget.transcript, style: EchoText.body()),
        ],
      ],
    );
  }
}
