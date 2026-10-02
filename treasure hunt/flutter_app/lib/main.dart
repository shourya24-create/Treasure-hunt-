/// main.dart — App entry point for The Echo Protocol.
library;

import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';

import 'firebase_options.dart';
import 'theme.dart';
import 'app_router.dart';
import 'services/auth_service.dart';
import 'services/team_service.dart';
import 'providers/team_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const EchoProtocolApp());
}

class EchoProtocolApp extends StatelessWidget {
  const EchoProtocolApp({super.key});

  @override
  Widget build(BuildContext context) {
    final authService = AuthService();
    final teamService = TeamService();

    return MultiProvider(
      providers: [
        Provider<AuthService>.value(value: authService),
        Provider<TeamService>.value(value: teamService),
        ChangeNotifierProvider<TeamProvider>(
          create: (_) => TeamProvider(teamService: teamService),
        ),
      ],
      child: MaterialApp.router(
        title: 'The Echo Protocol',
        theme: buildEchoTheme(),
        routerConfig: AppRouter.router,
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
