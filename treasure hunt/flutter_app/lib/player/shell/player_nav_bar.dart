/// player/shell/player_nav_bar.dart — The player's bottom bar (UI.md §3.1).
///
///   HOME   FRAGMENTS   [ SCAN ]   ARCHIVE   PROFILE
///
/// Four tabs and one action. The active tab is the screen's one gold element;
/// SCAN is the primary action, so it is signal green. A tab or the scanner
/// that cannot be used yet stays in place, dimmed, and says why when tapped.
library;

import 'package:flutter/material.dart';

import '../../theme.dart';

class PlayerNavItem {
  const PlayerNavItem({
    required this.label,
    required this.icon,
    this.lockedReason,
  });

  final String label;
  final IconData icon;

  /// Set while the tab cannot be opened: shown when it is tapped.
  final String? lockedReason;
}

class PlayerNavBar extends StatelessWidget {
  const PlayerNavBar({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onSelected,
    required this.onScan,
    required this.onLocked,
    this.scanLockedReason,
  }) : assert(items.length == 4);

  /// Two tabs left of SCAN, two right of it.
  final List<PlayerNavItem> items;
  final int currentIndex;
  final ValueChanged<int> onSelected;
  final VoidCallback onScan;

  /// Called with the reason when a locked tab or a locked SCAN is tapped.
  final ValueChanged<String> onLocked;

  /// Set while there is nothing to scan.
  final String? scanLockedReason;

  Widget _tab(int index) {
    final item = items[index];
    final reason = item.lockedReason;
    return Expanded(
      child: _NavTab(
        item: item,
        selected: index == currentIndex,
        onTap: reason == null ? () => onSelected(index) : () => onLocked(reason),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scanReason = scanLockedReason;
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: EchoColors.bgSurface,
        border: Border(top: BorderSide(color: EchoColors.hairline)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 76,
          child: Row(
            children: [
              _tab(0),
              _tab(1),
              Expanded(
                child: _ScanButton(
                  enabled: scanReason == null,
                  onTap: scanReason == null ? onScan : () => onLocked(scanReason),
                ),
              ),
              _tab(2),
              _tab(3),
            ],
          ),
        ),
      ),
    );
  }
}

/// Small enough for five labels on a narrow phone.
TextStyle _navLabel(Color color) =>
    EchoText.label(color: color).copyWith(fontSize: 10, letterSpacing: 1.2);

class _NavTab extends StatelessWidget {
  const _NavTab({required this.item, required this.selected, required this.onTap});

  final PlayerNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final locked = item.lockedReason != null;
    final color = selected
        ? EchoColors.highlightSelect
        : locked
            ? EchoColors.hairline
            : EchoColors.textMuted;

    return Semantics(
      button: true,
      selected: selected,
      label: locked ? '${item.label}, locked' : item.label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
        hoverColor: Colors.transparent,
        child: Column(
          // Bottom-aligned, so the five labels share one baseline.
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Icon(locked ? Icons.lock_outline : item.icon, size: 24, color: color),
            const SizedBox(height: 6),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(item.label.toUpperCase(), maxLines: 1, style: _navLabel(color)),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}

class _ScanButton extends StatelessWidget {
  const _ScanButton({required this.enabled, required this.onTap});

  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = enabled ? EchoColors.textPrimary : EchoColors.hairline;
    return Semantics(
      button: true,
      label: enabled ? 'Scan' : 'Scan, locked',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
        hoverColor: Colors.transparent,
        child: Column(
          // Bottom-aligned, so the five labels share one baseline.
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Container(
              width: 52,
              height: 40,
              decoration: BoxDecoration(
                color: enabled ? EchoColors.signalGreen : EchoColors.bgSurfaceRaised,
                border: Border.all(
                  color: enabled ? EchoColors.signalGreenBright : EchoColors.hairline,
                ),
                borderRadius: const BorderRadius.all(Radius.circular(2)),
              ),
              child: Icon(
                Icons.center_focus_strong,
                size: 24,
                color: enabled ? EchoColors.textHeadline : EchoColors.textMuted,
              ),
            ),
            const SizedBox(height: 6),
            Text('SCAN', maxLines: 1, style: _navLabel(label)),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}
