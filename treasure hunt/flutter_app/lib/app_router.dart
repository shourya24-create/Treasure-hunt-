/// app_router.dart — GoRouter configuration for the Echo Protocol Flutter app.
///
/// One app, two route trees (UI.md §1): the player side at `/…` with a
/// 4-tab shell, and the admin side at `/admin/…` with a rail. The redirect
/// keeps each role where it belongs and re-runs whenever the team or the
/// facilitator session changes.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'admin/final/final_screen.dart';
import 'admin/gate/gate_screen.dart';
import 'admin/leaderboard/leaderboard_screen.dart';
import 'admin/live/live_screen.dart';
import 'admin/log/log_screen.dart';
import 'admin/map/map_screen.dart';
import 'admin/setup/setup_screen.dart';
import 'admin/shell/admin_shell.dart';
import 'admin/teams/teams_screen.dart';
import 'core/providers/admin_providers.dart';
import 'core/providers/team_provider.dart';
import 'core/services/admin_service.dart';
import 'player/archive/archive_screen.dart';
import 'player/fragments/fragments_screen.dart';
import 'player/home/home_screen.dart';
import 'player/login/login_screen.dart';
import 'player/preflight/preflight_screen.dart';
import 'player/profile/profile_screen.dart';
import 'player/shell/player_shell.dart';
import 'theme.dart';
import 'widgets/echo_button.dart';
import 'widgets/echo_scaffold.dart';

class AppRouter {
  AppRouter._();

  static GoRouter create({
    required TeamProvider team,
    required AdminSessionProvider session,
  }) =>
      GoRouter(
        initialLocation: '/',
        refreshListenable: Listenable.merge([team, session]),
        redirect: (_, state) => _guard(state, team, session),
        routes: [
          // ── Full-screen routes, above the tabs ─────────────────────────────
          GoRoute(
            path: '/login',
            name: 'login',
            builder: (_, _) => const LoginScreen(),
          ),
          GoRoute(
            path: '/preflight',
            name: 'preflight',
            builder: (_, _) => const PreflightScreen(),
          ),

          // ── Player: 4 tabs, each keeps its scroll and state ────────────────
          StatefulShellRoute.indexedStack(
            builder: (_, _, navigationShell) =>
                PlayerShell(navigationShell: navigationShell),
            branches: [
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/',
                    name: 'home',
                    builder: (_, _) => const HomeScreen(),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/fragments',
                    name: 'fragments',
                    builder: (_, _) => const FragmentsScreen(),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/archive',
                    name: 'archive',
                    builder: (_, _) => const ArchiveScreen(),
                  ),
                ],
              ),
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/profile',
                    name: 'profile',
                    builder: (_, _) => const ProfileScreen(),
                  ),
                ],
              ),
            ],
          ),

          // ── Admin ──────────────────────────────────────────────────────────
          ShellRoute(
            builder: (_, state, child) =>
                AdminShell(location: state.uri.path, child: child),
            routes: [
              _adminTab('/admin/live', (_) => const LiveScreen()),
              _adminTab('/admin/map', (_) => const MapScreen()),
              _adminTab('/admin/teams', (_) => const TeamsScreen()),
              _adminTab(
                '/admin/teams/:id',
                (state) => TeamsScreen(selectedId: state.pathParameters['id']),
              ),
              _adminTab('/admin/gate', (_) => const GateScreen()),
              _adminTab('/admin/final', (_) => const FinalScreen()),
              _adminTab('/admin/leaderboard', (_) => const LeaderboardScreen()),
              _adminTab('/admin/log', (_) => const LogScreen()),
              _adminTab('/admin/setup', (_) => const SetupScreen()),
            ],
          ),
        ],
        errorBuilder: (_, _) => const _NotFoundScreen(),
      );

  /// Admin tabs swap without a page transition, like tabs.
  static GoRoute _adminTab(String path, Widget Function(GoRouterState) build) =>
      GoRoute(
        path: path,
        pageBuilder: (_, state) => NoTransitionPage(child: build(state)),
      );

  static String? _guard(
    GoRouterState state,
    TeamProvider team,
    AdminSessionProvider session,
  ) {
    final user = FirebaseAuth.instance.currentUser;
    final location = state.matchedLocation;
    final atLogin = location == '/login';
    final inAdmin = location.startsWith('/admin');

    // Not signed in → /login.
    if (user == null) return atLogin ? null : '/login';
    // A facilitator's role is still being looked up: stay put.
    if (!session.resolved) return null;

    // Facilitator → /admin/live. Desk volunteer → gate and final desks only.
    final role = session.role;
    if (role == FacilitatorRole.desk) {
      final allowed = location.startsWith('/admin/gate') ||
          location.startsWith('/admin/final');
      return allowed ? null : '/admin/gate';
    }
    if (role == FacilitatorRole.admin) return inAdmin ? null : '/admin/live';

    // Player: can never open /admin/…
    if (!team.resolved || !team.preflightKnown) return null;
    if (team.view == null) return atLogin ? null : '/login';
    if (!team.preflightDone) return location == '/preflight' ? null : '/preflight';
    if (atLogin || inAdmin || location == '/preflight') return '/';
    // Until the admin starts the game only Home and Profile open.
    final gameTab = location == '/fragments' || location == '/archive';
    if (gameTab && !team.game.started) return '/';
    return null;
  }
}

/// Shown for an address that matches no route: a mistyped or stale link.
///
/// The way back is "/" for everyone. The redirect above turns it into the
/// Home tab for a team, the dashboard for a facilitator and the login for
/// a phone that is not signed in.
class _NotFoundScreen extends StatelessWidget {
  const _NotFoundScreen();

  @override
  Widget build(BuildContext context) => EchoScaffold(
        body: SafeArea(
          child: EchoPage(
            children: [
              const SizedBox(height: 56),
              Text('PAGE NOT FOUND', style: EchoText.headline(size: 40)),
              const SizedBox(height: 16),
              Text(
                'There is nothing at this address.',
                style: EchoText.body(size: 18),
              ),
              const SizedBox(height: 32),
              EchoButton.primary(
                label: 'Back to home',
                onPressed: () => context.go('/'),
              ),
            ],
          ),
        ),
      );
}
