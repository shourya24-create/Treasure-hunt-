/// player/home/home_screen.dart — The Home tab: what to do now, then the briefing.
///
/// The card at the top follows the team's Firestore view, the game state and
/// the clock, so a reload always shows the right one (GAMEPLAY.md §9). Under
/// it is the landing page: who Echo is and how the game works. There is no
/// decision screen here on purpose: the decision is recorded by a club member.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/models/game.dart';
import '../../core/models/team.dart';
import '../../core/providers/game_clock_provider.dart';
import '../../core/providers/team_provider.dart';
import '../../theme.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/fragment_tracker.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';
import 'home_content.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TeamProvider>();
    final now = context.watch<GameClockProvider>().now;
    final view = provider.view;
    final stage = provider.stage(now);

    if (view == null || stage == MissionStage.loading) {
      return const DecryptingText();
    }

    return EchoPage(
      children: [
        _NowCard(stage: stage, view: view, game: provider.game),
        const SizedBox(height: 36),

        // ── The story ────────────────────────────────────────────────────────
        const SectionLabel('Incoming transmission'),
        const SizedBox(height: 12),
        Text(HomeContent.title.toUpperCase(), style: EchoText.headline(size: 38)),
        const SizedBox(height: 16),
        for (final paragraph in HomeContent.story) ...[
          Text(paragraph, style: EchoText.body(size: 17)),
          const SizedBox(height: 12),
        ],
        const SizedBox(height: 24),

        // ── How it works ─────────────────────────────────────────────────────
        const SectionLabel('How it works'),
        const SizedBox(height: 12),
        for (final (i, step) in HomeContent.steps.indexed) ...[
          _StepRow(number: i + 1, step: step),
          const SizedBox(height: 10),
        ],
        const SizedBox(height: 26),

        // ── Rules ────────────────────────────────────────────────────────────
        const SectionLabel('Field rules'),
        const SizedBox(height: 12),
        EchoCard(
          child: Column(
            children: [
              for (final (i, rule) in HomeContent.rules.indexed) ...[
                if (i > 0) const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Text('—', style: EchoText.mono(color: EchoColors.textMuted)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text(rule, style: EchoText.body())),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// The one thing the team should do right now.
class _NowCard extends StatelessWidget {
  const _NowCard({required this.stage, required this.view, required this.game});

  final MissionStage stage;
  final TeamView view;
  final GameState game;

  @override
  Widget build(BuildContext context) {
    final Color border;
    final Widget tag;
    final Widget headline;
    final String text;
    Widget? extra;

    Widget title(String value, {Color color = EchoColors.textHeadline}) =>
        Text(value, style: EchoText.headline(size: 30, color: color));

    switch (stage) {
      case MissionStage.waitingRoom:
        // Held, not failed: amber.
        border = EchoColors.warningAmber;
        tag = const StatusTag('Standing by', status: EchoStatus.warning);
        headline = title('WAITING FOR START');
        text = 'Wait for the admin to start the game. Until then, read the '
            'briefing below. Fragments, Scan and Archive unlock when the game '
            'starts.';

      case MissionStage.objective:
        final n = view.completions + 1;
        final arrived = view.activeCheckpoint != null;
        border = EchoColors.signalGreen;
        tag = StatusTag(
          arrived ? 'Signal locked' : 'Fragment $n open',
          status: EchoStatus.live,
        );
        headline = title(arrived ? 'FINISH THE ACTIVITY' : 'FIND FRAGMENT $n');
        text = arrived
            ? 'You are in the right place. Finish the activity there to '
                'recover the fragment.'
            : 'Your clue and the object to look for are in Fragments. When '
                'you reach it, tap Scan.';
        extra = EchoButton.ghost(
          label: 'Open fragments',
          onPressed: () => context.go('/fragments'),
        );

      case MissionStage.returnToBase:
        border = EchoColors.signalGreen;
        tag = const StatusTag('All fragments recovered', status: EchoStatus.done);
        headline = title('RETURN TO BASE');
        text = 'Walk back to the starting room. Echo has one more message for you.';

      case MissionStage.finalQueue:
        final position = game.finalQueue.indexOf(view.id) + 1;
        final yourTurn = game.inHeadset == view.id;
        border = EchoColors.signalGreen;
        tag = yourTurn
            ? const StatusTag('Headset ready for your team', status: EchoStatus.live)
            : const StatusTag('Final', status: EchoStatus.idle);
        headline = title(yourTurn ? 'YOUR TURN' : 'HEADSET QUEUE');
        text = yourTurn
            ? 'One member of your team puts the headset on and watches '
                'Echo\'s message. Then decide together and tell the club '
                'member. Your clock stops when they record it.'
            : 'Report to the club member at the headset desk. Waiting time '
                'counts, so stay close.';
        if (!yourTurn) {
          extra = Center(
            child: Text(
              position > 0 ? '#$position' : '#—',
              style: EchoText.mono(size: 72, weight: FontWeight.w700),
            ),
          );
        }

      case MissionStage.complete:
        border = EchoColors.hairline;
        tag = const StatusTag('Transmission closed', status: EchoStatus.done);
        headline = title('DECISION RECORDED');
        text = 'Your run is complete. The club will announce the results.';

      case MissionStage.gameOver:
        border = EchoColors.dangerRedBright;
        tag = const StatusTag('Campus signal closed', status: EchoStatus.failed);
        headline = FailureFlash(
          builder: (context, color) => title('TIME\'S UP', color: color),
        );
        text = 'Return to the starting room. You keep what you have earned, '
            'and you still make the final decision.';

      // Focus mode covers the tabs for these, so Home is never seen with them.
      case MissionStage.loading:
      case MissionStage.gateCode:
      case MissionStage.reward:
        return const SizedBox.shrink();
    }

    return EchoCard(
      raised: true,
      borderColor: border,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: tag),
              const SectionLabel('Now', color: EchoColors.textMuted),
            ],
          ),
          const SizedBox(height: 14),
          headline,
          const SizedBox(height: 10),
          Text(text, style: EchoText.body()),
          if (game.started) ...[
            const SizedBox(height: 18),
            FragmentTracker(
              done: view.completions,
              showCurrent: stage == MissionStage.objective,
            ),
          ],
          if (extra != null) ...[
            const SizedBox(height: 18),
            extra,
          ],
        ],
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({required this.number, required this.step});

  final int number;
  final HomeStep step;

  @override
  Widget build(BuildContext context) => EchoCard(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                border: Border.all(color: EchoColors.signalGreen),
              ),
              child: Text('$number', style: EchoText.mono(color: EchoColors.textHeadline)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(step.title.toUpperCase(), style: EchoText.headline(size: 18)),
                  const SizedBox(height: 4),
                  Text(step.text, style: EchoText.body()),
                ],
              ),
            ),
          ],
        ),
      );
}
