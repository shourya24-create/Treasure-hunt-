/// widgets/echo_scaffold.dart — Page background: bg-void + grain (+ optional scan-lines).
///
/// UI.md §2.4: a static tiled noise image at 3% opacity over every background,
/// and scan-lines on hero screens only.
library;

import 'package:flutter/material.dart';

import '../theme.dart';

class EchoScaffold extends StatelessWidget {
  const EchoScaffold({
    super.key,
    required this.body,
    this.appBar,
    this.bottomNavigationBar,
    this.drawer,
    this.scanlines = false,
  });

  final Widget body;
  final PreferredSizeWidget? appBar;
  final Widget? bottomNavigationBar;
  final Widget? drawer;

  /// Hero screens only: Waiting Room, Chapter playback, Return to Base,
  /// Mission Complete, Game Over, Leaderboard projector mode.
  final bool scanlines;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: EchoColors.bgVoid,
        appBar: appBar,
        drawer: drawer,
        bottomNavigationBar: bottomNavigationBar,
        body: Stack(
          children: [
            Positioned.fill(child: body),
            const Positioned.fill(child: GrainOverlay()),
            if (scanlines) const Positioned.fill(child: ScanlineOverlay()),
          ],
        ),
      );
}

/// The static noise tile. Not animated, so it is cheap on low-end phones.
class GrainOverlay extends StatelessWidget {
  const GrainOverlay({super.key});

  @override
  Widget build(BuildContext context) => const IgnorePointer(
        child: Opacity(
          opacity: 0.03,
          child: DecoratedBox(
            decoration: BoxDecoration(
              image: DecorationImage(
                image: AssetImage('assets/textures/noise.png'),
                repeat: ImageRepeat.repeat,
              ),
            ),
          ),
        ),
      );
}

/// Faint horizontal bands, like an old CRT or a bad photocopy.
class ScanlineOverlay extends StatelessWidget {
  const ScanlineOverlay({super.key});

  @override
  Widget build(BuildContext context) => const IgnorePointer(
        child: RepaintBoundary(child: CustomPaint(painter: _ScanlinePainter())),
      );
}

class _ScanlinePainter extends CustomPainter {
  const _ScanlinePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = EchoColors.shade.withValues(alpha: 0.22)
      ..strokeWidth = 1;
    for (var y = 0.0; y < size.height; y += 3) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(_ScanlinePainter oldDelegate) => false;
}

/// Centers page content in one readable, scrolling column with generous spacing.
class EchoPage extends StatelessWidget {
  const EchoPage({
    super.key,
    required this.children,
    this.maxWidth = 520,
    this.padding = const EdgeInsets.fromLTRB(20, 28, 20, 48),
  });

  final List<Widget> children;
  final double maxWidth;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: ListView(padding: padding, children: children),
        ),
      );
}
