/// screens/create_join_screen.dart — Create a new team or join by code.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../providers/team_provider.dart';
import '../theme.dart';

class CreateJoinScreen extends StatefulWidget {
  const CreateJoinScreen({super.key});

  @override
  State<CreateJoinScreen> createState() => _CreateJoinScreenState();
}

class _CreateJoinScreenState extends State<CreateJoinScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);

  final _nameCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();

  @override
  void dispose() {
    _tabs.dispose();
    _nameCtrl.dispose();
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) return;
    final provider = context.read<TeamProvider>();
    try {
      final result = await provider.createTeam(name);
      if (mounted) {
        context.goNamed('scan', pathParameters: {'teamId': result.teamId});
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to create team: $e'),
            backgroundColor: EchoColors.error,
          ),
        );
      }
    }
  }

  Future<void> _join() async {
    final code = _codeCtrl.text.trim().toUpperCase();
    if (code.isEmpty) return;
    final provider = context.read<TeamProvider>();
    try {
      final teamId = await provider.joinTeam(code);
      if (mounted) {
        context.goNamed('scan', pathParameters: {'teamId': teamId});
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not join: $e'),
            backgroundColor: EchoColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TeamProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('ECHO PROTOCOL')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            children: [
              TabBar(
                controller: _tabs,
                labelColor: EchoColors.cyan,
                unselectedLabelColor: EchoColors.textSecondary,
                indicatorColor: EchoColors.cyan,
                tabs: const [
                  Tab(text: 'CREATE TEAM'),
                  Tab(text: 'JOIN TEAM'),
                ],
              ),
              Expanded(
                child: TabBarView(
                  controller: _tabs,
                  children: [
                    // ── Create ──────────────────────────────────────────────
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          TextField(
                            controller: _nameCtrl,
                            decoration: const InputDecoration(
                              labelText: 'Team Name',
                              hintText: 'e.g. Unit Sigma',
                            ),
                          ),
                          const SizedBox(height: 24),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: provider.loading ? null : _create,
                              child: provider.loading
                                  ? const SizedBox(
                                      height: 20, width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: EchoColors.background,
                                      ),
                                    )
                                  : const Text('INITIALISE TEAM'),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // ── Join ────────────────────────────────────────────────
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          TextField(
                            controller: _codeCtrl,
                            decoration: const InputDecoration(
                              labelText: 'Join Code',
                              hintText: 'e.g. XK7M2',
                            ),
                            textCapitalization: TextCapitalization.characters,
                            maxLength: 5,
                          ),
                          const SizedBox(height: 24),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: provider.loading ? null : _join,
                              child: provider.loading
                                  ? const SizedBox(
                                      height: 20, width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: EchoColors.background,
                                      ),
                                    )
                                  : const Text('CONNECT TO TEAM'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
