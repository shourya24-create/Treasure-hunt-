/// widgets/chapter_player.dart — Plays a voice line: play/pause, progress, transcript.
///
/// Used for Echo's chapters (keyed by step) and for station reactions. Every
/// line has a transcript, since campuses are noisy (UI.md §8). If the audio is
/// not delivered yet, fails to load or takes too long to load, the transcript
/// opens and playback counts as finished, so a team is never stuck behind a
/// missing file.
///
/// The audio is downloaded only when it is about to be played, and only one
/// voice line sounds at a time across the app: starting one pauses the other.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../core/models/chapter.dart';
import '../core/models/game.dart';
import '../theme.dart';
import 'status_dot.dart';

/// Where the audio file stands: not asked for yet, on its way, playable, or
/// given up on.
enum _Audio { idle, loading, ready, unavailable }

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

  /// Load and start as soon as the widget appears (a fresh unlock). Without
  /// it, nothing is downloaded until the team taps play.
  final bool autoPlay;
  final bool transcriptOpen;

  /// Called once, when the line has played to the end (or cannot be played).
  final VoidCallback? onCompleted;
  final ValueChanged<bool>? onPlayingChanged;

  @override
  State<ChapterPlayer> createState() => _ChapterPlayerState();
}

class _ChapterPlayerState extends State<ChapterPlayer>
    with AutomaticKeepAliveClientMixin {
  /// On weak campus Wi-Fi, or when iOS Safari never reports the file's
  /// metadata, a load can hang for good. Past this it counts as failed.
  static const _loadTimeout = Duration(seconds: 8);

  /// The one line that may sound right now, on any tab.
  static _ChapterPlayerState? _speaking;

  /// Created with the first load, so a line nobody plays costs no download.
  AudioPlayer? _player;
  final List<StreamSubscription<dynamic>> _subs = [];

  _Audio _audio = _Audio.idle;
  bool _playing = false;

  /// The line has run to its end; the next tap starts it over.
  bool _atEnd = false;
  bool _completed = false;
  Duration _position = Duration.zero;
  Duration? _duration;
  late bool _transcriptOpen = widget.transcriptOpen;

  /// A loaded line outlives its card scrolling out of a list: it keeps
  /// playing, and coming back to it does not download it again.
  @override
  bool get wantKeepAlive => _player != null;

  @override
  void initState() {
    super.initState();
    if (isPlaceholder(widget.audioUrl)) {
      // Not delivered yet: nothing to load, the transcript stands in.
      _audio = _Audio.unavailable;
      _transcriptOpen = true;
      _complete();
    } else if (widget.autoPlay) {
      _audio = _Audio.loading;
      _load();
    }
  }

  /// Downloads the line, then starts it. Runs when a fresh unlock appears, on
  /// the first tap of play, and to play a finished line again.
  Future<void> _load() async {
    _takeFloor();
    var player = _player;
    if (player == null) {
      player = _player = AudioPlayer();
      _subs.add(player.playerStateStream.listen(_onState));
      _subs.add(player.positionStream.listen((p) {
        if (mounted) setState(() => _position = p);
      }));
    }

    final Duration? duration;
    try {
      // Setting the source again is what takes just_audio out of "completed";
      // a line that had run to its end then starts over from the top.
      duration = await player
          .setUrl(widget.audioUrl, initialPosition: _atEnd ? Duration.zero : null)
          .timeout(_loadTimeout);
    } catch (_) {
      // A load that fails and one that never finishes end the same way.
      _markUnavailable();
      return;
    }
    if (!mounted || _player != player) return;
    setState(() {
      _audio = _Audio.ready;
      _atEnd = false;
      _duration = duration;
    });

    // Another line was started while this one was loading: it keeps the floor.
    if (_speaking != this) return;
    try {
      await player.play();
    } catch (_) {
      // Browsers refuse sound that no tap asked for, for example after a
      // reload while a reward is pending. The line IS loaded, so the play
      // button stays and the team taps it. just_audio still reports
      // "playing" after a refusal; pausing clears that.
      await _hush(player);
    }
  }

  /// Only one voice line sounds at a time: taking the floor pauses whichever
  /// line had it.
  void _takeFloor() {
    final other = _speaking;
    _speaking = this;
    final otherPlayer = other == this ? null : other?._player;
    if (otherPlayer != null) _hush(otherPlayer);
  }

  /// Pauses where a failure to do so has nowhere useful to go.
  static Future<void> _hush(AudioPlayer player) async {
    try {
      await player.pause();
    } catch (_) {}
  }

  /// The audio cannot be had: the transcript stands in for it and the line
  /// counts as played.
  void _markUnavailable() {
    _closePlayer();
    if (!mounted) return;
    final wasPlaying = _playing;
    setState(() {
      _audio = _Audio.unavailable;
      _playing = false;
      _transcriptOpen = true;
    });
    if (wasPlaying) widget.onPlayingChanged?.call(false);
    updateKeepAlive();
    _complete();
  }

  void _onState(PlayerState state) {
    if (!mounted) return;
    final ended = state.processingState == ProcessingState.completed;
    final playing = state.playing && !ended;
    if (playing != _playing) {
      setState(() => _playing = playing);
      widget.onPlayingChanged?.call(playing);
    }
    if (!ended) return;
    if (!_atEnd) setState(() => _atEnd = true);
    _complete();
    // just_audio stays "playing" at the end of a file and would ignore the
    // next play(). Pausing is what lets the line be started again.
    final player = _player;
    if (state.playing && player != null) _hush(player);
  }

  void _complete() {
    if (_completed) return;
    _completed = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onCompleted?.call();
    });
  }

  Future<void> _toggle() async {
    final player = _player;
    if (player == null || _atEnd) {
      // The first tap, or a line that has run to its end: load, then start.
      setState(() => _audio = _Audio.loading);
      return _load();
    }
    try {
      if (_playing) {
        await player.pause();
      } else {
        _takeFloor();
        await player.play();
      }
    } catch (_) {
      // The team asked for a loaded line and it would not play.
      _markUnavailable();
    }
  }

  /// Lets go of the audio. A download still under way is dropped with it.
  void _closePlayer() {
    for (final sub in _subs) {
      sub.cancel();
    }
    _subs.clear();
    _player?.dispose();
    _player = null;
    if (_speaking == this) _speaking = null;
  }

  @override
  void dispose() {
    _closePlayer();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final total = _duration;
    final fraction = total == null || total.inMilliseconds == 0
        ? 0.0
        : (_position.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0).toDouble();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_audio == _Audio.unavailable)
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
                  // Disabled only while the audio is on its way.
                  onPressed: _audio == _Audio.loading ? null : _toggle,
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
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('TRANSCRIPT'),
                const SizedBox(width: 4),
                // An icon, not a triangle character: the bundled Oswald has
                // none, and a missing glyph makes the engine fetch a font.
                Icon(
                  _transcriptOpen ? Icons.arrow_drop_up : Icons.arrow_drop_down,
                  size: 20,
                ),
              ],
            ),
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
