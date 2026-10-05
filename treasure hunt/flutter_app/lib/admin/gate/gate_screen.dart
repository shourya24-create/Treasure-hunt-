/// admin/gate/gate_screen.dart — The CP1 desk: who gets which paper and code.
///
/// The app never issues gate codes by itself; a volunteer hands them over
/// after checking the solved paper (GAMEPLAY.md §4.2). This screen is the
/// volunteer's reference. Codes are hidden until revealed and hide again
/// after 10 seconds.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/game.dart';
import '../../core/models/route.dart';
import '../../core/models/team.dart';
import '../../core/providers/admin_providers.dart';
import '../../core/services/admin_service.dart';
import '../../core/services/backend_call.dart' show readableError;
import '../../theme.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_card.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';

class GateScreen extends StatefulWidget {
  const GateScreen({super.key});

  @override
  State<GateScreen> createState() => _GateScreenState();
}

class _GateScreenState extends State<GateScreen> {
  Map<String, String> _codes = const {};
  String? _error;

  /// Teams whose code is visible right now, each with its 10-second timer.
  final Map<String, Timer> _revealed = {};

  @override
  void initState() {
    super.initState();
    _loadCodes();
  }

  Future<void> _loadCodes() async {
    try {
      final codes = await context.read<AdminService>().listGateCodes();
      if (mounted) setState(() => _codes = codes);
    } catch (e) {
      if (mounted) setState(() => _error = readableError(e));
    }
  }

  void _reveal(String teamId) {
    _revealed[teamId]?.cancel();
    setState(() {
      _revealed[teamId] = Timer(const Duration(seconds: 10), () {
        if (mounted) setState(() => _revealed.remove(teamId));
      });
    });
  }

  @override
  void dispose() {
    for (final timer in _revealed.values) {
      timer.cancel();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AdminDataProvider>();
    final paired = {for (final pair in sharedStartPairs) ...pair};
    final singles = data.teams.where((t) => !paired.contains(t.id)).toList();

    Widget row(TeamDoc t) => _GateRow(
          team: t,
          game: data.game,
          code: _codes[t.id],
          revealed: _revealed.containsKey(t.id),
          onReveal: () => _reveal(t.id),
        );

    return EchoPage(
      maxWidth: 760,
      children: [
        const SectionLabel('CP1 gate desk'),
        const SizedBox(height: 8),
        Text(
          'Check the solved paper, then hand the team its code by hand.',
          style: EchoText.body(color: EchoColors.textSecondary),
        ),
        const SizedBox(height: 20),
        if (_error != null) ...[
          FailureCard(_error!, onRetry: () {
            setState(() => _error = null);
            _loadCodes();
          }),
          const SizedBox(height: 20),
        ],

        // ── Pairs that share a start checkpoint ──────────────────────────────
        for (final pair in sharedStartPairs) ...[
          EchoCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final id in pair)
                  if (data.team(id) case final t?) ...[
                    row(t),
                    const SizedBox(height: 10),
                  ],
                Text(
                  'Same first checkpoint — hold the 2nd code ~2–3 min if both '
                  'are ready together.',
                  style: EchoText.body(color: EchoColors.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        // ── Teams that start alone ───────────────────────────────────────────
        for (final t in singles) ...[
          EchoCard(padding: const EdgeInsets.all(16), child: row(t)),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _GateRow extends StatelessWidget {
  const _GateRow({
    required this.team,
    required this.game,
    required this.code,
    required this.revealed,
    required this.onReveal,
  });

  final TeamDoc team;
  final GameState game;
  final String? code;
  final bool revealed;
  final VoidCallback onReveal;

  @override
  Widget build(BuildContext context) {
    final entered = team.cp1DoneAt;
    final start = game.startedAt;
    // Time on the game clock when the code went in.
    final enteredText = entered == null
        ? null
        : start == null
            ? formatClock(entered)
            : formatDuration(entered.difference(start));

    return Wrap(
      spacing: 20,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        SizedBox(
          width: 150,
          child: Text(team.label.toUpperCase(), style: EchoText.headline(size: 20)),
        ),
        SizedBox(
          width: 70,
          child: Text(team.paperVariant, style: EchoText.mono(color: EchoColors.textSecondary)),
        ),
        SizedBox(
          width: 150,
          child: Text(
            revealed ? (code ?? '—') : '••••••',
            style: EchoText.mono(
              size: 16,
              spacing: 2,
              color: revealed ? EchoColors.textHeadline : EchoColors.textMuted,
            ),
          ),
        ),
        EchoButton.ghost(
          label: revealed ? 'Shown' : 'Reveal',
          onPressed: revealed || code == null ? null : onReveal,
        ),
        enteredText == null
            ? const StatusTag('Not entered', status: EchoStatus.idle)
            : StatusTag('Entered $enteredText', status: EchoStatus.done),
      ],
    );
  }
}
