/// player/login/login_screen.dart — Team ID + password, and facilitator login.
///
/// Teams are created by the club, not by players. The first phone to log a
/// team in owns it for the whole event; a second phone is refused
/// (GAMEPLAY.md §4.1). The router sends a successful login onward.
///
/// Phase 4: checks browser compatibility before allowing sign-in on web.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/admin_providers.dart';
import '../../core/providers/team_provider.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/team_service.dart' show readableError;
import '../../theme.dart';
import '../../widgets/browser_compat_guard.dart';
import '../../widgets/code_field.dart';
import '../../widgets/echo_button.dart';
import '../../widgets/echo_scaffold.dart';
import '../../widgets/section_label.dart';
import '../../widgets/status_dot.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _teamCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _facPassCtrl = TextEditingController();
  bool _facilitator = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _teamCtrl.dispose();
    _passCtrl.dispose();
    _emailCtrl.dispose();
    _facPassCtrl.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action, {String? fallback}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await action();
      // On success the router redirects; there is nothing to do here.
    } catch (e) {
      if (mounted) setState(() => _error = fallback ?? readableError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _teamLogin() {
    final teamId = _teamCtrl.text.trim().toUpperCase();
    final password = _passCtrl.text.trim();
    if (teamId.isEmpty || password.isEmpty) {
      setState(() => _error = 'Enter your team ID and password.');
      return;
    }
    _run(() => context.read<TeamProvider>().claimTeam(teamId, password));
  }

  void _facilitatorLogin() {
    if (_emailCtrl.text.trim().isEmpty || _facPassCtrl.text.isEmpty) {
      setState(() => _error = 'Enter email and password.');
      return;
    }
    _run(
      () => context.read<AuthService>().signInWithEmailAndPassword(
            email: _emailCtrl.text.trim(),
            password: _facPassCtrl.text,
          ),
      fallback: 'Login failed. Check credentials.',
    );
  }

  @override
  Widget build(BuildContext context) {
    // Signed in with an email account that is not a facilitator.
    final session = context.watch<AdminSessionProvider>();
    final user = context.read<AuthService>().currentUser;
    final notFacilitator =
        user != null && !user.isAnonymous && session.resolved && session.role == null;

    return BrowserCompatGuard(
        child: EchoScaffold(
          scanlines: true,
          body: SafeArea(
            child: EchoPage(
              maxWidth: 440,
              children: [
                const SizedBox(height: 48),
                Text(
                  'THE ECHO PROTOCOL',
                  textAlign: TextAlign.center,
                  style: EchoText.headline(size: 38),
                ),
                const SizedBox(height: 12),
                const Center(child: SectionLabel('System access required')),
                const SizedBox(height: 48),

                if (!_facilitator) ...[
                  // ── Team sign-in ─────────────────────────────────────────
                  CodeField(
                    controller: _teamCtrl,
                    label: 'TEAM ID',
                    hint: 'T5',
                    large: false,
                    enabled: !_loading,
                  ),
                  const SizedBox(height: 12),
                  CodeField(
                    controller: _passCtrl,
                    label: 'PASSWORD',
                    large: false,
                    obscure: true,
                    enabled: !_loading,
                    onSubmitted: (_) => _teamLogin(),
                  ),
                  const SizedBox(height: 24),
                  EchoButton.primary(
                    label: 'Connect',
                    onPressed: _loading ? null : _teamLogin,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'This phone becomes your team\'s only device for the whole event.',
                    textAlign: TextAlign.center,
                    style: EchoText.body(color: EchoColors.textSecondary),
                  ),
                ] else ...[
                  // ── Facilitator sign-in ──────────────────────────────────
                  TextField(
                    controller: _emailCtrl,
                    enabled: !_loading,
                    style: EchoText.mono(size: 16),
                    decoration: const InputDecoration(labelText: 'EMAIL'),
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _facPassCtrl,
                    enabled: !_loading,
                    style: EchoText.mono(size: 16),
                    decoration: const InputDecoration(labelText: 'PASSWORD'),
                    obscureText: true,
                    onSubmitted: (_) => _facilitatorLogin(),
                  ),
                  const SizedBox(height: 24),
                  EchoButton.primary(
                    label: 'Facilitator access',
                    onPressed: _loading ? null : _facilitatorLogin,
                  ),
                ],

                if (_loading) ...[
                  const SizedBox(height: 20),
                  const DecryptingText(label: 'CONNECTING'),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 20),
                  FailureCard(_error!),
                ] else if (notFacilitator) ...[
                  const SizedBox(height: 20),
                  const FailureCard('This account is not a facilitator. Ask the club admin.'),
                ],

                const SizedBox(height: 40),
                TextButton(
                  onPressed: _loading
                      ? null
                      : () => setState(() {
                            _facilitator = !_facilitator;
                            _error = null;
                          }),
                  child: Text(_facilitator ? 'BACK TO TEAM LOGIN' : 'FACILITATOR LOGIN'),
                ),
              ],
            ),
          ),
        ),
      );
  }
}
