/// widgets/browser_compat_guard.dart — Phase 4: browser compatibility check.
///
/// On Flutter Web, inspects the User-Agent for known-incompatible browsers:
/// - In-app browsers (Instagram, FBAN, FBAV, WhatsApp, Snapchat, TikTok)
/// - iOS Safari < 15 (WebAssembly.instantiateStreaming not supported)
///
/// If incompatible, shows a plain warning screen instead of silently failing
/// when the user later tries to open the AR scanner.
///
/// On non-web platforms this widget is a transparent pass-through.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../theme.dart';
import 'echo_scaffold.dart';
import 'status_dot.dart';

// UA detection runs on web only; import conditionally.
// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html show window;

class BrowserCompatGuard extends StatefulWidget {
  const BrowserCompatGuard({super.key, required this.child});
  final Widget child;

  @override
  State<BrowserCompatGuard> createState() => _BrowserCompatGuardState();
}

class _BrowserCompatGuardState extends State<BrowserCompatGuard> {
  late final _CompatResult _result;

  @override
  void initState() {
    super.initState();
    _result = kIsWeb ? _check() : _CompatResult.ok;
  }

  static _CompatResult _check() {
    // ignore: avoid_web_libraries_in_flutter
    final ua = html.window.navigator.userAgent;

    // ── In-app browser detection ────────────────────────────────────────
    final inAppPatterns = [
      'FBAN', 'FBAV',      // Facebook
      'Instagram',
      'WhatsApp',
      'Snapchat',
      'TikTok',
      'Twitter',
      'Line/',
      'KAKAOTALK',
    ];
    for (final p in inAppPatterns) {
      if (ua.contains(p)) {
        return _CompatResult.inAppBrowser;
      }
    }

    // ── iOS Safari version detection ────────────────────────────────────
    // UA form on iOS: "... iPhone OS 14_x ..."
    final iosVersionMatch = RegExp(r'iPhone OS (\d+)_').firstMatch(ua) ??
        RegExp(r'iPad; CPU OS (\d+)_').firstMatch(ua);
    if (iosVersionMatch != null) {
      final major = int.tryParse(iosVersionMatch.group(1) ?? '99') ?? 99;
      if (major < 15) return _CompatResult.iosTooOld;
    }

    return _CompatResult.ok;
  }

  @override
  Widget build(BuildContext context) => switch (_result) {
        _CompatResult.ok => widget.child,
        _CompatResult.inAppBrowser => const _IncompatibleScreen(
            icon: Icons.open_in_browser,
            title: 'OPEN IN YOUR BROWSER',
            body: 'The Echo Protocol uses your camera for AR scanning.\n\n'
                'In-app browsers (Instagram, WhatsApp, etc.) block camera '
                'access. Please copy the link and open it in Chrome or Safari.',
          ),
        _CompatResult.iosTooOld => const _IncompatibleScreen(
            icon: Icons.system_update,
            title: 'iOS UPDATE REQUIRED',
            // No arrows: Noto Serif has no glyph for them, and a missing glyph
            // makes the engine fetch a fallback font at runtime.
            body: 'The AR scanner requires iOS 15 or later.\n\n'
                'Please update your device in Settings > General > Software Update.',
          ),
      };
}

enum _CompatResult { ok, inAppBrowser, iosTooOld }

class _IncompatibleScreen extends StatelessWidget {
  const _IncompatibleScreen({
    required this.icon,
    required this.title,
    required this.body,
  });
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => EchoScaffold(
        body: SafeArea(
          child: Center(
            // Scrolls rather than overflows on a short screen.
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // The browser cannot run the scanner: a failure, so red —
                  // one flash as the screen appears, then static.
                  FailureFlash(
                    builder: (context, color) => Icon(icon, color: color, size: 56),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    title,
                    style: EchoText.headline(size: 24),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    body,
                    style: EchoText.body(),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
}
