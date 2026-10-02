/// admin/shell/admin_actions.dart — Helpers every admin tab shares.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/game.dart';
import '../../core/models/team.dart';
import '../../core/providers/admin_providers.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/status_dot.dart';

/// Sends one facilitator action and reports the outcome in a notice.
/// Returns true if it succeeded.
Future<bool> runAdminAction(
  BuildContext context,
  String type, {
  required String done,
  String? teamId,
  String? checkpointId,
  String? decision,
  SnackBarAction? undo,
}) async {
  final error = await context.read<AdminDataProvider>().act(
        type,
        teamId: teamId,
        checkpointId: checkpointId,
        decision: decision,
      );
  if (!context.mounted) return error == null;
  if (error != null) {
    showEchoNotice(context, error, failed: true);
    return false;
  }
  showEchoNotice(
    context,
    done,
    action: undo,
    duration: Duration(seconds: undo == null ? 4 : 30),
  );
  return true;
}

/// How a team's chip or pin is coloured: red = phone offline, amber = no
/// progress for 15+ minutes, bright green = in play, dim green = finished.
EchoStatus teamStatusColor(TeamDoc team, AdminDataProvider data, DateTime now) {
  if (team.status == TeamStatus.finished) return EchoStatus.done;
  if (data.isOffline(team, now)) return EchoStatus.failed;
  if (data.isIdle(team, now)) return EchoStatus.warning;
  if (team.status == TeamStatus.waiting) return EchoStatus.idle;
  return EchoStatus.live;
}

/// What a team is doing right now, in words.
String teamActivity(TeamDoc team, GameState game, DateTime now) {
  if (team.status == TeamStatus.finished) return 'Finished';
  if (team.status == TeamStatus.atFinal) {
    return game.inHeadset == team.id ? 'In headset' : 'Headset queue';
  }
  if (team.paused || game.paused) return 'Paused';
  if (team.status == TeamStatus.waiting) return 'In room';
  if (team.nextCheckpoint == null || game.closed(now)) return 'Returning';
  if (team.arrivalCp != null) return 'At ${team.arrivalCp}';
  return 'To ${team.nextCheckpoint}';
}

/// May be marked as arrived at the final: all 7 done, or the campus is closed.
bool readyForFinal(TeamDoc team, GameState game, DateTime now) =>
    team.finalArrivedAt == null &&
    ((team.cp1Done && team.remaining.isEmpty) || game.closed(now));
