/// admin/shell/admin_shell.dart — Facilitator frame: navigation + game header.
///
/// A left NavigationRail on a laptop; below 900 px it becomes a Drawer for the
/// desk volunteer on a phone. The active item is the screen's one gold
/// element. A desk volunteer sees GATE and FINAL only (UI.md §4.1–4.2).
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/admin_providers.dart';
import '../../core/services/auth_service.dart';
import '../../theme.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/status_dot.dart';
import 'game_header.dart';

class AdminTab {
  const AdminTab(this.path, this.label, this.icon, {this.desk = false});
  final String path;
  final String label;
  final IconData icon;

  /// A desk volunteer may open this tab.
  final bool desk;
}

const adminTabs = [
  AdminTab('/admin/live', 'LIVE', Icons.sensors),
  AdminTab('/admin/map', 'MAP', Icons.map_outlined),
  AdminTab('/admin/teams', 'TEAMS', Icons.groups_outlined),
  AdminTab('/admin/gate', 'GATE', Icons.key_outlined, desk: true),
  AdminTab('/admin/final', 'FINAL', Icons.headset_outlined, desk: true),
  AdminTab('/admin/leaderboard', 'BOARD', Icons.leaderboard_outlined),
  AdminTab('/admin/log', 'LOG', Icons.receipt_long_outlined),
  AdminTab('/admin/setup', 'SETUP', Icons.tune),
];

class AdminShell extends StatelessWidget {
  const AdminShell({super.key, required this.location, required this.child});

  /// The current route, used to mark the active tab.
  final String location;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AdminSessionProvider>();
    final data = context.watch<AdminDataProvider>();
    final tabs = session.isAdmin
        ? adminTabs
        : adminTabs.where((t) => t.desk).toList();
    final active = tabs.indexWhere((t) => location.startsWith(t.path));
    final wide = MediaQuery.sizeOf(context).width >= 900;

    Future<void> signOut() => context.read<AuthService>().signOut();

    final content = Column(
      children: [
        const GameHeader(),
        Expanded(
          child: data.error != null
              ? const EchoPage(
                  children: [
                    FailureCard(
                      'Facilitator access required — this account cannot read the teams',
                    ),
                  ],
                )
              : !data.loaded
                  ? const DecryptingText()
                  : child,
        ),
      ],
    );

    if (wide) {
      return EchoScaffold(
        body: SafeArea(
          child: Row(
            children: [
              NavigationRail(
                selectedIndex: active < 0 ? null : active,
                labelType: NavigationRailLabelType.all,
                onDestinationSelected: (i) => context.go(tabs[i].path),
                destinations: [
                  for (final tab in tabs)
                    NavigationRailDestination(
                      icon: Icon(tab.icon),
                      label: Text(tab.label),
                    ),
                ],
                trailing: Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: IconButton(
                    icon: const Icon(Icons.logout),
                    tooltip: 'Sign out',
                    onPressed: signOut,
                  ),
                ),
              ),
              const VerticalDivider(width: 1),
              Expanded(child: content),
            ],
          ),
        ),
      );
    }

    return EchoScaffold(
      appBar: AppBar(title: const Text('CONTROL')),
      drawer: Drawer(
        child: SafeArea(
          child: ListView(
            children: [
              for (var i = 0; i < tabs.length; i++)
                ListTile(
                  leading: Icon(tabs[i].icon),
                  title: Text(tabs[i].label),
                  selected: i == active,
                  selectedColor: EchoColors.highlightSelect,
                  iconColor: EchoColors.textMuted,
                  textColor: EchoColors.textMuted,
                  titleTextStyle: EchoText.label(),
                  onTap: () {
                    Navigator.of(context).pop();
                    context.go(tabs[i].path);
                  },
                ),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('SIGN OUT'),
                iconColor: EchoColors.textMuted,
                textColor: EchoColors.textMuted,
                titleTextStyle: EchoText.label(),
                onTap: signOut,
              ),
            ],
          ),
        ),
      ),
      body: SafeArea(child: content),
    );
  }
}
