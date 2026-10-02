/// screens/journal_screen.dart — Displays evidence cards from completed fragments.
///
/// Reads QuestRecord sub-collection from Firestore in real time.
/// No AR-specific rendering — text/data only.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../providers/team_provider.dart';
import '../models/quest_record.dart';
import '../theme.dart';

class JournalScreen extends StatefulWidget {
  const JournalScreen({super.key, required this.teamId});
  final String teamId;

  @override
  State<JournalScreen> createState() => _JournalScreenState();
}

class _JournalScreenState extends State<JournalScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TeamProvider>().attach(widget.teamId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TeamProvider>();
    final completed = provider.fragments
        .where((f) => f.status == FragmentStatus.completed)
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('JOURNAL'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.goNamed(
            'scan',
            pathParameters: {'teamId': widget.teamId},
          ),
        ),
      ),
      body: completed.isEmpty
          ? const Center(
              child: Text(
                'No fragments recovered yet.',
                style: TextStyle(color: EchoColors.textSecondary),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: completed.length,
              itemBuilder: (_, i) => _FragmentJournalCard(fragment: completed[i]),
            ),
    );
  }
}

class _FragmentJournalCard extends StatelessWidget {
  const _FragmentJournalCard({required this.fragment});
  final QuestRecord fragment;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.lock_open, color: EchoColors.success, size: 16),
                const SizedBox(width: 8),
                Text(
                  fragment.fragmentId,
                  style: const TextStyle(
                    color: EchoColors.cyan,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2,
                  ),
                ),
                const Spacer(),
                if (fragment.completedAt != null)
                  Text(
                    _formatTime(fragment.completedAt!.toDate()),
                    style: const TextStyle(
                      color: EchoColors.textSecondary, fontSize: 11,
                    ),
                  ),
              ],
            ),
            if (fragment.evidence.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Divider(),
              ...fragment.evidence.map(
                (e) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        e.label.toUpperCase(),
                        style: const TextStyle(
                          color: EchoColors.textSecondary,
                          fontSize: 10,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        e.data,
                        style: const TextStyle(color: EchoColors.textPrimary),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 8),
            Text(
              '${fragment.hintsUsed} hint${fragment.hintsUsed == 1 ? "" : "s"} used',
              style: const TextStyle(
                color: EchoColors.textSecondary, fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) =>
      '${dt.hour.toString().padLeft(2, "0")}:${dt.minute.toString().padLeft(2, "0")}';
}
