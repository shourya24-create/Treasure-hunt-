/// screens/scan_screen.dart — Main game HUD: fragment status, countdown, AR launcher.
///
/// Phase 3: displays the countdown timer reading startedAt + timeLimit - pausedDuration.
/// Does NOT build the AR content — that lives in the field app at /field/.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../providers/team_provider.dart';
import '../models/team_doc.dart';
import '../models/quest_record.dart';
import '../theme.dart';
import '../widgets/countdown_timer_widget.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key, required this.teamId});
  final String teamId;

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TeamProvider>().attach(widget.teamId);
    });
  }

  Future<void> _openFieldApp() async {
    // Same-origin navigation: Flutter at / and field app at /field/
    // launchUrl with _self reuses the Firebase anonymous session.
    final uri = Uri.parse('/field/');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, webOnlyWindowName: '_self');
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not launch the AR scanner.'),
            backgroundColor: EchoColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TeamProvider>();
    final team = provider.team;
    final fragments = provider.fragments;

    if (team == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final activeFragment = fragments
        .where((f) => f.status == FragmentStatus.active)
        .firstOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Text(team.name.toUpperCase()),
        actions: [
          IconButton(
            icon: const Icon(Icons.menu_book),
            tooltip: 'Journal',
            onPressed: () => context.goNamed(
              'journal',
              pathParameters: {'teamId': widget.teamId},
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Timer bar ────────────────────────────────────────────────────────
          if (team.startedAt != null && team.status == TeamStatus.playing)
            CountdownTimerWidget(team: team),

          if (team.status == TeamStatus.paused)
            Container(
              color: EchoColors.amber.withOpacity(0.15),
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.pause_circle, color: EchoColors.amber, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'RUN PAUSED',
                    style: TextStyle(
                      color: EchoColors.amber,
                      letterSpacing: 2,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),

          if (team.status == TeamStatus.finished)
            Container(
              color: EchoColors.success.withOpacity(0.15),
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle, color: EchoColors.success, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'RUN COMPLETE',
                    style: TextStyle(
                      color: EchoColors.success,
                      letterSpacing: 2,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),

          // ── Fragment list ─────────────────────────────────────────────────────
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ...fragments.map((f) => _FragmentTile(fragment: f)),
                const SizedBox(height: 24),

                // ── AR launcher ──────────────────────────────────────────────
                if (activeFragment != null &&
                    team.status == TeamStatus.playing)
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.camera_alt),
                      label: Text('OPEN SCANNER — ${activeFragment.fragmentId}'),
                      onPressed: _openFieldApp,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FragmentTile extends StatelessWidget {
  const _FragmentTile({required this.fragment});
  final QuestRecord fragment;

  @override
  Widget build(BuildContext context) {
    final (icon, color) = switch (fragment.status) {
      FragmentStatus.completed => (Icons.lock_open, EchoColors.success),
      FragmentStatus.active    => (Icons.radio_button_on, EchoColors.cyan),
      FragmentStatus.locked    => (Icons.lock, EchoColors.textSecondary),
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: color),
        title: Text(
          fragment.fragmentId,
          style: TextStyle(color: color, fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          fragment.status.name.toUpperCase(),
          style: const TextStyle(
            color: EchoColors.textSecondary, fontSize: 11, letterSpacing: 1.5,
          ),
        ),
        trailing: fragment.status == FragmentStatus.completed
            ? Text(
                '${fragment.hintsUsed} hint${fragment.hintsUsed == 1 ? "" : "s"}',
                style: const TextStyle(color: EchoColors.textSecondary, fontSize: 12),
              )
            : null,
      ),
    );
  }
}
