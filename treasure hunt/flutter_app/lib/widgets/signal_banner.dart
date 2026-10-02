/// widgets/signal_banner.dart — Offline / back-online banner under the top bar.
///
/// Offline: red "SIGNAL LOST · RETRYING". Back online: green for 2 seconds,
/// then it hides (UI.md §3.8).
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../theme.dart';
import 'status_dot.dart';

class SignalBanner extends StatefulWidget {
  const SignalBanner({super.key, required this.online});
  final bool online;

  @override
  State<SignalBanner> createState() => _SignalBannerState();
}

class _SignalBannerState extends State<SignalBanner> {
  bool _showRestored = false;
  Timer? _hide;

  @override
  void didUpdateWidget(SignalBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.online && widget.online) {
      setState(() => _showRestored = true);
      _hide?.cancel();
      _hide = Timer(const Duration(seconds: 2), () {
        if (mounted) setState(() => _showRestored = false);
      });
    }
  }

  @override
  void dispose() {
    _hide?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.online) {
      return FailureFlash(
        builder: (context, color) => _bar(
          color: color,
          child: const StatusTag('Signal lost · retrying', status: EchoStatus.failed),
        ),
      );
    }
    if (_showRestored) {
      return _bar(
        color: EchoColors.signalGreen,
        child: const StatusTag('Signal restored', status: EchoStatus.live),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _bar({required Color color, required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.18),
          border: Border(bottom: BorderSide(color: color)),
        ),
        child: child,
      );
}
