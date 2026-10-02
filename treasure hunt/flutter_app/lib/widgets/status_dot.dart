/// widgets/status_dot.dart — Status indicators (DESIGN_SYSTEM.md §5, UI.md §2.5).
///
/// live = bright green, slow pulse · done = dim green, static ·
/// failed = red, one flash then static · warning = amber · idle = muted.
/// Colour never carries the meaning alone: StatusTag always adds a word.
library;

import 'package:flutter/material.dart';

import '../theme.dart';

enum EchoStatus { live, done, failed, warning, idle }

/// Opacity breathing 60–100% over 1.6 s. Only for bright-green live states.
/// Shows no pulse when the system asks for reduced motion.
class Pulse extends StatefulWidget {
  const Pulse({super.key, required this.child});
  final Widget child;

  @override
  State<Pulse> createState() => _PulseState();
}

class _PulseState extends State<Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) return widget.child;
    return FadeTransition(
      opacity: Tween<double>(begin: 0.6, end: 1).animate(
        CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
      ),
      child: widget.child,
    );
  }
}

/// One 150 ms flash to danger-red-bright, then a static danger-red.
class FailureFlash extends StatelessWidget {
  const FailureFlash({super.key, required this.builder});

  /// Builds the failed element with the colour to use right now.
  final Widget Function(BuildContext context, Color color) builder;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) {
      return builder(context, EchoColors.dangerRed);
    }
    return TweenAnimationBuilder<Color?>(
      tween: ColorTween(begin: EchoColors.dangerRedBright, end: EchoColors.dangerRed),
      duration: const Duration(milliseconds: 150),
      curve: Curves.easeIn,
      builder: (context, color, _) => builder(context, color ?? EchoColors.dangerRed),
    );
  }
}

class StatusDot extends StatelessWidget {
  const StatusDot(this.status, {super.key, this.size = 9});

  const StatusDot.live({super.key, this.size = 9}) : status = EchoStatus.live;
  const StatusDot.done({super.key, this.size = 9}) : status = EchoStatus.done;
  const StatusDot.failed({super.key, this.size = 9}) : status = EchoStatus.failed;
  const StatusDot.warning({super.key, this.size = 9}) : status = EchoStatus.warning;

  final EchoStatus status;
  final double size;

  Widget _dot(Color fill, Color border) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: fill,
          border: Border.all(color: border),
          shape: BoxShape.circle,
        ),
      );

  @override
  Widget build(BuildContext context) => switch (status) {
        EchoStatus.live => Pulse(
            child: _dot(EchoColors.signalGreenBright, EchoColors.signalGreenBright),
          ),
        EchoStatus.done => _dot(EchoColors.signalGreenDim, EchoColors.signalGreen),
        EchoStatus.failed => FailureFlash(builder: (_, color) => _dot(color, color)),
        EchoStatus.warning => _dot(EchoColors.warningAmber, EchoColors.warningAmber),
        EchoStatus.idle => _dot(Colors.transparent, EchoColors.textMuted),
      };
}

/// A dot plus the word that says what it means.
class StatusTag extends StatelessWidget {
  const StatusTag(this.label, {super.key, required this.status});
  final String label;
  final EchoStatus status;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          StatusDot(status),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              label.toUpperCase(),
              style: EchoText.label(
                color: status == EchoStatus.idle || status == EchoStatus.done
                    ? EchoColors.textSecondary
                    : EchoColors.textPrimary,
              ),
            ),
          ),
        ],
      );
}

/// A failure card: red border that flashes once, readable text, optional retry.
class FailureCard extends StatelessWidget {
  const FailureCard(this.message, {super.key, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => FailureFlash(
        builder: (context, color) => Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: EchoColors.dangerRed.withValues(alpha: 0.18),
            border: Border.all(color: color),
            borderRadius: const BorderRadius.all(Radius.circular(2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(message.toUpperCase(), style: EchoText.mono(size: 13)),
              if (onRetry != null) ...[
                const SizedBox(height: 12),
                OutlinedButton(
                  style: EchoButtonStyles.ghost,
                  onPressed: onRetry,
                  child: const Text('TRY AGAIN'),
                ),
              ],
            ],
          ),
        ),
      );
}

/// Loading state: mono "DECRYPTING…" with a blinking caret. No spinners.
class DecryptingText extends StatefulWidget {
  const DecryptingText({super.key, this.label = 'DECRYPTING'});
  final String label;

  @override
  State<DecryptingText> createState() => _DecryptingTextState();
}

class _DecryptingTextState extends State<DecryptingText>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final still = MediaQuery.of(context).disableAnimations;
    return Center(
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (context, _) => Text(
          '${widget.label}…${still || _ctrl.value < 0.5 ? '_' : ' '}',
          style: EchoText.mono(color: EchoColors.textSecondary, spacing: 2),
        ),
      ),
    );
  }
}
