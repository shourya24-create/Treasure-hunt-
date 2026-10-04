/// player/preflight/preflight_screen.dart — Shown once after the first login,
/// before lights-off: CAMERA, LOCATION, SOUND.
///
/// Each row goes ghost → live → done. READY is enabled only when all three
/// are done. A denied permission turns its row red, with the fix for Android
/// and iPhone (UI.md §3.5).
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:provider/provider.dart';

import '../../core/providers/team_provider.dart';
import '../../core/services/camera_check.dart';
import '../../core/services/location_service.dart';
import '../../theme.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';

enum _Check { idle, running, done, failed }

class PreflightScreen extends StatefulWidget {
  const PreflightScreen({super.key});

  @override
  State<PreflightScreen> createState() => _PreflightScreenState();
}

class _PreflightScreenState extends State<PreflightScreen> {
  _Check _camera = _Check.idle;
  _Check _location = _Check.idle;
  _Check _sound = _Check.idle;

  bool get _allDone =>
      _camera == _Check.done && _location == _Check.done && _sound == _Check.done;

  Future<void> _checkCamera() async {
    setState(() => _camera = _Check.running);
    final ok = await requestCameraAccess();
    if (mounted) setState(() => _camera = ok ? _Check.done : _Check.failed);
  }

  Future<void> _checkLocation() async {
    setState(() => _location = _Check.running);
    final ok = await context.read<LocationService>().requestPermission();
    if (mounted) setState(() => _location = ok ? _Check.done : _Check.failed);
  }

  /// Plays a short test tone. The team confirms by ear; the row is done when
  /// the tone has played through.
  Future<void> _checkSound() async {
    setState(() => _sound = _Check.running);
    final player = AudioPlayer();
    var ok = false;
    try {
      await player.setAsset('assets/audio/test_tone.wav');
      await player.play().timeout(const Duration(seconds: 6));
      ok = true;
    } catch (_) {
      ok = false;
    } finally {
      await player.dispose();
    }
    if (mounted) setState(() => _sound = ok ? _Check.done : _Check.failed);
  }

  @override
  Widget build(BuildContext context) => EchoScaffold(
        body: SafeArea(
          child: EchoPage(
            children: [
              const SizedBox(height: 24),
              const SectionLabel('Before the lights go off'),
              const SizedBox(height: 16),
              Text('PREFLIGHT CHECK', style: EchoText.headline(size: 36)),
              const SizedBox(height: 12),
              Text(
                'Three quick checks so this phone works on campus.',
                style: EchoText.body(color: EchoColors.textSecondary),
              ),
              const SizedBox(height: 28),
              _CheckRow(
                title: 'Camera',
                detail: 'Needed to scan the object at each checkpoint.',
                state: _camera,
                onRun: _checkCamera,
                fix: 'Android: tap the lock icon in the address bar, then '
                    'Permissions, then Camera, then Allow. Press RETRY.\n'
                    'iPhone: open Settings, then Safari, then Camera, then '
                    'Allow. Reload this page.',
              ),
              const SizedBox(height: 12),
              _CheckRow(
                title: 'Location',
                detail: 'Lets the club see where your team is.',
                state: _location,
                onRun: _checkLocation,
                fix: 'Android: tap the lock icon in the address bar, then '
                    'Permissions, then Location, then Allow. Press RETRY.\n'
                    'iPhone: open Settings, then Privacy, then Location '
                    'Services, then Safari, then While Using. Reload this page.',
              ),
              const SizedBox(height: 12),
              _CheckRow(
                title: 'Sound',
                detail: 'Plays a test tone. Turn the volume up so you can hear Echo.',
                state: _sound,
                onRun: _checkSound,
                fix: 'Turn the volume up and switch off silent mode, then press RETRY.',
              ),
              const SizedBox(height: 32),
              EchoButton.primary(
                label: 'Ready',
                onPressed: _allDone
                    ? () => context.read<TeamProvider>().completePreflight()
                    : null,
              ),
            ],
          ),
        ),
      );
}

class _CheckRow extends StatelessWidget {
  const _CheckRow({
    required this.title,
    required this.detail,
    required this.state,
    required this.onRun,
    required this.fix,
  });

  final String title;
  final String detail;
  final _Check state;
  final VoidCallback onRun;

  /// Step-by-step fix, shown when the check failed.
  final String fix;

  @override
  Widget build(BuildContext context) {
    final failed = state == _Check.failed;
    final tag = switch (state) {
      _Check.idle => const StatusTag('Not checked', status: EchoStatus.idle),
      _Check.running => const StatusTag('Checking', status: EchoStatus.live),
      _Check.done => const StatusTag('Done', status: EchoStatus.done),
      _Check.failed => const StatusTag('Failed', status: EchoStatus.failed),
    };

    return EchoCard(
      borderColor: failed ? EchoColors.dangerRed : EchoColors.hairline,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(title.toUpperCase(), style: EchoText.headline(size: 22)),
              ),
              tag,
            ],
          ),
          const SizedBox(height: 8),
          Text(failed ? fix : detail, style: EchoText.body()),
          if (state == _Check.idle || failed) ...[
            const SizedBox(height: 16),
            EchoButton.ghost(label: failed ? 'Retry' : 'Check', onPressed: onRun),
          ],
        ],
      ),
    );
  }
}
