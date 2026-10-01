/// app_router.dart — GoRouter configuration for the Echo Protocol Flutter app.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'screens/login_screen.dart';
import 'screens/create_join_screen.dart';
import 'screens/scan_screen.dart';
import 'screens/journal_screen.dart';
import 'screens/admin_dashboard_screen.dart';

class AppRouter {
  AppRouter._();

  static final GoRouter router = GoRouter(
    initialLocation: '/login',
    redirect: _guard,
    routes: [
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (_, __) => const LoginScreen(),
      ),
      GoRoute(
        path: '/team',
        name: 'team',
        builder: (_, __) => const CreateJoinScreen(),
      ),
      GoRoute(
        path: '/scan/:teamId',
        name: 'scan',
        builder: (_, state) =>
            ScanScreen(teamId: state.pathParameters['teamId']!),
      ),
      GoRoute(
        path: '/journal/:teamId',
        name: 'journal',
        builder: (_, state) =>
            JournalScreen(teamId: state.pathParameters['teamId']!),
      ),
      GoRoute(
        path: '/admin',
        name: 'admin',
        builder: (_, __) => const AdminDashboardScreen(),
      ),
    ],
    errorBuilder: (_, state) => Scaffold(
      body: Center(
        child: Text('Page not found: ${state.error}'),
      ),
    ),
  );

  static String? _guard(BuildContext context, GoRouterState state) {
    final user = FirebaseAuth.instance.currentUser;
    final loggingIn = state.matchedLocation == '/login';

    if (user == null && !loggingIn) return '/login';
    if (user != null && loggingIn) return '/team';
    return null;
  }
}
