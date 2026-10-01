/// screens/admin_dashboard_screen.dart — Facilitator control panel.
///
/// Three tabs: Team Status table, Hint Queue, Facilitator Actions.
/// Reads via watchAllTeams() — works because Firestore rules grant facilitators
/// collection-level read on /teams.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../services/team_service.dart';
import '../models/team_doc.dart';
import '../theme.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final teamService = context.read<TeamService>();
    final authService = context.read<AuthService>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('ADMIN — ECHO PROTOCOL'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: () async {
              await authService.signOut();
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          labelColor: EchoColors.cyan,
          unselectedLabelColor: EchoColors.textSecondary,
          indicatorColor: EchoColors.cyan,
          tabs: const [
            Tab(text: 'TEAMS'),
            Tab(text: 'HINTS'),
            Tab(text: 'ACTIONS'),
          ],
        ),
      ),
      body: StreamBuilder<List<TeamDoc>>(
        stream: teamService.watchAllTeams(),
        builder: (context, snap) {
          if (snap.hasError) {
            return Center(
              child: Text(
                'Error: ${snap.error}',
                style: const TextStyle(color: EchoColors.error),
              ),
            );
          }
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final teams = snap.data!;

          return TabBarView(
            controller: _tabs,
            children: [
              _TeamStatusTab(teams: teams, teamService: teamService),
              _HintQueueTab(teams: teams, teamService: teamService),
              _ActionsTab(teams: teams, teamService: teamService),
            ],
          );
        },
      ),
    );
  }
}

// ── Tab 1: Team Status ─────────────────────────────────────────────────────────

class _TeamStatusTab extends StatelessWidget {
  const _TeamStatusTab({required this.teams, required this.teamService});
  final List<TeamDoc> teams;
  final TeamService teamService;

  @override
  Widget build(BuildContext context) {
    if (teams.isEmpty) {
      return const Center(
        child: Text('No teams yet.', style: TextStyle(color: EchoColors.textSecondary)),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: teams.length,
      itemBuilder: (_, i) => _TeamStatusCard(team: teams[i]),
    );
  }
}

class _TeamStatusCard extends StatelessWidget {
  const _TeamStatusCard({required this.team});
  final TeamDoc team;

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (team.status) {
      TeamStatus.playing  => EchoColors.success,
      TeamStatus.paused   => EchoColors.amber,
      TeamStatus.finished => EchoColors.textSecondary,
      TeamStatus.waiting  => EchoColors.cyan,
    };

    final remaining = team.remainingSeconds;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  team.name,
                  style: const TextStyle(
                    color: EchoColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    border: Border.all(color: statusColor),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    team.status.name.toUpperCase(),
                    style: TextStyle(color: statusColor, fontSize: 10, letterSpacing: 1.5),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Fragment: F0${team.currentFragmentIndex + 1}   '
              'Members: ${team.members.length}   '
              'Code: ${team.joinCode}',
              style: const TextStyle(color: EchoColors.textSecondary, fontSize: 12),
            ),
            if (remaining != null) ...[
              const SizedBox(height: 4),
              Text(
                'Time remaining: ${_fmt(remaining)}',
                style: TextStyle(
                  color: remaining < 300 ? EchoColors.error : EchoColors.textSecondary,
                  fontSize: 12,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _fmt(int secs) {
    final m = secs ~/ 60;
    final s = secs % 60;
    return '${m.toString().padLeft(2, "0")}:${s.toString().padLeft(2, "0")}';
  }
}

// ── Tab 2: Hint Queue ──────────────────────────────────────────────────────────

class _HintQueueTab extends StatefulWidget {
  const _HintQueueTab({required this.teams, required this.teamService});
  final List<TeamDoc> teams;
  final TeamService teamService;

  @override
  State<_HintQueueTab> createState() => _HintQueueTabState();
}

class _HintQueueTabState extends State<_HintQueueTab> {
  String? _selectedTeamId;
  String? _selectedFragment;
  int _hintLevel = 1;
  bool _sending = false;

  Future<void> _sendHint() async {
    if (_selectedTeamId == null || _selectedFragment == null) return;
    setState(() => _sending = true);
    try {
      await widget.teamService.sendFacilitatorAction(
        type: 'hint',
        teamId: _selectedTeamId!,
        fragmentId: _selectedFragment!,
        hintLevel: _hintLevel,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Hint level $_hintLevel sent to $_selectedTeamId / $_selectedFragment'),
            backgroundColor: EchoColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: EchoColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final teamIds = widget.teams.map((t) => (id: t.id, name: t.name)).toList();
    final fragments = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08'];

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'SEND HINT',
            style: TextStyle(
              color: EchoColors.cyan, letterSpacing: 2, fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            decoration: const InputDecoration(labelText: 'Team'),
            value: _selectedTeamId,
            dropdownColor: EchoColors.surfaceHigh,
            items: teamIds
                .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                .toList(),
            onChanged: (v) => setState(() => _selectedTeamId = v),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            decoration: const InputDecoration(labelText: 'Fragment'),
            value: _selectedFragment,
            dropdownColor: EchoColors.surfaceHigh,
            items: fragments
                .map((f) => DropdownMenuItem(value: f, child: Text(f)))
                .toList(),
            onChanged: (v) => setState(() => _selectedFragment = v),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Text('Hint Level:', style: TextStyle(color: EchoColors.textSecondary)),
              const SizedBox(width: 16),
              for (final lvl in [1, 2, 3])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text('$lvl'),
                    selected: _hintLevel == lvl,
                    selectedColor: EchoColors.cyan,
                    onSelected: (_) => setState(() => _hintLevel = lvl),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _sending ? null : _sendHint,
            child: _sending
                ? const SizedBox(
                    height: 18, width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: EchoColors.background),
                  )
                : const Text('DELIVER HINT'),
          ),
        ],
      ),
    );
  }
}

// ── Tab 3: Actions ─────────────────────────────────────────────────────────────

class _ActionsTab extends StatefulWidget {
  const _ActionsTab({required this.teams, required this.teamService});
  final List<TeamDoc> teams;
  final TeamService teamService;

  @override
  State<_ActionsTab> createState() => _ActionsTabState();
}

class _ActionsTabState extends State<_ActionsTab> {
  String? _selectedTeamId;
  String? _selectedFragment;
  bool _busy = false;

  Future<void> _action(String type, {String? fragmentId}) async {
    if (_selectedTeamId == null) return;
    setState(() => _busy = true);
    try {
      await widget.teamService.sendFacilitatorAction(
        type: type,
        teamId: _selectedTeamId!,
        fragmentId: fragmentId ?? _selectedFragment,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$type sent.'),
            backgroundColor: EchoColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: EchoColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final teamIds = widget.teams.map((t) => (id: t.id, name: t.name)).toList();
    final fragments = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08'];

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DropdownButtonFormField<String>(
            decoration: const InputDecoration(labelText: 'Team'),
            value: _selectedTeamId,
            dropdownColor: EchoColors.surfaceHigh,
            items: teamIds
                .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                .toList(),
            onChanged: (v) => setState(() => _selectedTeamId = v),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            decoration: const InputDecoration(labelText: 'Fragment (for force-complete)'),
            value: _selectedFragment,
            dropdownColor: EchoColors.surfaceHigh,
            items: fragments
                .map((f) => DropdownMenuItem(value: f, child: Text(f)))
                .toList(),
            onChanged: (v) => setState(() => _selectedFragment = v),
          ),
          const SizedBox(height: 24),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _ActionButton(
                label: '▶ RESUME', color: EchoColors.success,
                busy: _busy,
                onTap: () => _action('resume'),
              ),
              _ActionButton(
                label: '⏸ PAUSE', color: EchoColors.amber,
                busy: _busy,
                onTap: () => _action('pause'),
              ),
              _ActionButton(
                label: '⏭ FORCE COMPLETE', color: EchoColors.cyan,
                busy: _busy,
                onTap: () => _action('forceComplete'),
              ),
              _ActionButton(
                label: '↺ RESET', color: EchoColors.error,
                busy: _busy,
                onTap: () => _action('reset'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.color,
    required this.busy,
    required this.onTap,
  });
  final String label;
  final Color color;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => OutlinedButton(
        style: OutlinedButton.styleFrom(
          foregroundColor: color,
          side: BorderSide(color: color),
        ),
        onPressed: busy ? null : onTap,
        child: Text(label),
      );
}
