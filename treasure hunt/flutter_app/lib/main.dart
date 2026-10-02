/// main.dart — App entry point for The Echo Protocol.
library;

import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'firebase_options.dart';
import 'theme.dart';
import 'app_router.dart';
import 'core/providers/admin_providers.dart';
import 'core/providers/game_clock_provider.dart';
import 'core/providers/team_provider.dart';
import 'core/services/admin_service.dart';
import 'core/services/auth_service.dart';
import 'core/services/location_service.dart';
import 'core/services/team_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const EchoProtocolApp());
}

class EchoProtocolApp extends StatefulWidget {
  const EchoProtocolApp({super.key});

  @override
  State<EchoProtocolApp> createState() => _EchoProtocolAppState();
}

class _EchoProtocolAppState extends State<EchoProtocolApp> {
  // Created once: the router listens to the providers, so they must outlive rebuilds.
  late final AuthService _auth = AuthService();
  late final TeamService _teams = TeamService();
  late final AdminService _admin = AdminService();
  late final LocationService _location = LocationService(teamService: _teams);
  late final GameClockProvider _clock = GameClockProvider();
  late final TeamProvider _team = TeamProvider(
    teamService: _teams,
    authService: _auth,
    locationService: _location,
  );
  late final AdminSessionProvider _session = AdminSessionProvider(
    authService: _auth,
    adminService: _admin,
  );
  late final AdminDataProvider _adminData = AdminDataProvider(
    adminService: _admin,
    teamService: _teams,
    session: _session,
  );
  late final GoRouter _router = AppRouter.create(team: _team, session: _session);

  @override
  void dispose() {
    _router.dispose();
    _adminData.dispose();
    _session.dispose();
    _team.dispose();
    _clock.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MultiProvider(
        providers: [
          Provider<AuthService>.value(value: _auth),
          Provider<TeamService>.value(value: _teams),
          Provider<AdminService>.value(value: _admin),
          Provider<LocationService>.value(value: _location),
          ChangeNotifierProvider<GameClockProvider>.value(value: _clock),
          ChangeNotifierProvider<TeamProvider>.value(value: _team),
          ChangeNotifierProvider<AdminSessionProvider>.value(value: _session),
          ChangeNotifierProvider<AdminDataProvider>.value(value: _adminData),
        ],
        child: MaterialApp.router(
          title: 'The Echo Protocol',
          theme: buildEchoTheme(),
          routerConfig: _router,
          debugShowCheckedModeBanner: false,
        ),
      );
}
