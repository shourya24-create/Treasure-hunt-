/// theme.dart — EchoColors palette, EchoText type roles and global ThemeData.
///
/// Implements DESIGN_SYSTEM.md v2 and UI.md §2. Every non-base colour has
/// exactly one job:
///   red = failed, right now · amber = being measured · bright green = live ·
///   dim green = done · gold = the one selected thing on a screen.
/// Widgets use these names only. No raw `Color(0x…)` outside this file.
library;

import 'package:flutter/material.dart';

// ── Colour palette (UI.md §2.1) ────────────────────────────────────────────────

class EchoColors {
  EchoColors._();

  static const bgVoid = Color(0xFF0B0C0A);
  static const bgSurface = Color(0xFF13150F);
  static const bgSurfaceRaised = Color(0xFF1B1E15);
  static const hairline = Color(0xFF2A2E22);

  static const textPrimary = Color(0xFFC8D4B0);
  static const textSecondary = Color(0xFF8A9478);
  static const textMuted = Color(0xFF5B5E4E);
  static const textHeadline = Color(0xFFE8EEDC);

  static const signalGreen = Color(0xFF4F8F3F);
  static const signalGreenBright = Color(0xFF7FD858);
  static const signalGreenDim = Color(0xFF2E4524);

  static const dangerRed = Color(0xFF7A2320);
  static const dangerRedBright = Color(0xFFB23A2E);

  static const warningAmber = Color(0xFFA6822E);

  static const highlightSelect = Color(0xFFC9A227);

  /// Texture and dimming only: scan-lines, the dim behind a modal.
  static const shade = Color(0xFF000000);
}

// ── Type roles (UI.md §2.3) ────────────────────────────────────────────────────

class EchoText {
  EchoText._();

  static const _headlineFont = 'Oswald';
  static const _bodyFont = 'NotoSerif';
  static const _monoFont = 'JetBrainsMono';

  /// Oswald, ALL CAPS, tight tracking: screen titles, chapter titles, big buttons.
  static TextStyle headline({
    double size = 26,
    Color color = EchoColors.textHeadline,
  }) =>
      TextStyle(
        fontFamily: _headlineFont,
        fontSize: size,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
        height: 1.1,
        color: color,
      );

  /// Oswald, ALL CAPS, small, wide tracking: section labels.
  static TextStyle label({Color color = EchoColors.textSecondary}) => TextStyle(
        fontFamily: _headlineFont,
        fontSize: 12,
        fontWeight: FontWeight.w400,
        letterSpacing: 2.2,
        height: 1.3,
        color: color,
      );

  /// Noto Serif: clues, chapter transcripts, any prose. At least 16 sp.
  static TextStyle body({
    double size = 16,
    Color color = EchoColors.textPrimary,
  }) =>
      TextStyle(
        fontFamily: _bodyFont,
        fontSize: size,
        height: 1.55,
        color: color,
      );

  /// JetBrains Mono: timers, codes, team IDs, times, points, coordinates.
  static TextStyle mono({
    double size = 14,
    Color color = EchoColors.textPrimary,
    FontWeight weight = FontWeight.w500,
    double spacing = 0.5,
  }) =>
      TextStyle(
        fontFamily: _monoFont,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: spacing,
        color: color,
      );
}

// ── Button styles (DESIGN_SYSTEM.md §5) ────────────────────────────────────────

const _sharp = RoundedRectangleBorder(
  borderRadius: BorderRadius.all(Radius.circular(2)),
);

class EchoButtonStyles {
  EchoButtonStyles._();

  static ButtonStyle _filled({
    required Color background,
    required Color border,
    required Color pressed,
  }) =>
      ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.disabled)
              ? EchoColors.bgSurface
              : background,
        ),
        foregroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.disabled)
              ? EchoColors.textMuted
              : EchoColors.textHeadline,
        ),
        overlayColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.pressed)
              ? pressed.withValues(alpha: 0.35)
              : pressed.withValues(alpha: 0.12),
        ),
        side: WidgetStateProperty.resolveWith(
          (states) => BorderSide(
            color: states.contains(WidgetState.disabled)
                ? EchoColors.hairline
                : border,
          ),
        ),
        elevation: const WidgetStatePropertyAll(0),
        shape: const WidgetStatePropertyAll(_sharp),
        minimumSize: const WidgetStatePropertyAll(Size(48, 52)),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        ),
        textStyle: WidgetStatePropertyAll(
          EchoText.headline(size: 17).copyWith(letterSpacing: 1.5),
        ),
      );

  /// Primary action: Scan, Verify, Start.
  static final ButtonStyle primary = _filled(
    background: EchoColors.signalGreenDim,
    border: EchoColors.signalGreen,
    pressed: EchoColors.signalGreenBright,
  );

  /// Destructive action: Destroy Echo, End game, Release phone.
  static final ButtonStyle destructive = _filled(
    background: EchoColors.dangerRed,
    border: EchoColors.dangerRedBright,
    pressed: EchoColors.dangerRedBright,
  );

  /// Secondary / ghost.
  static final ButtonStyle ghost = ButtonStyle(
    backgroundColor: const WidgetStatePropertyAll(Colors.transparent),
    foregroundColor: WidgetStateProperty.resolveWith(
      (states) => states.contains(WidgetState.disabled)
          ? EchoColors.textMuted
          : EchoColors.textSecondary,
    ),
    overlayColor: WidgetStatePropertyAll(
      EchoColors.signalGreen.withValues(alpha: 0.12),
    ),
    side: const WidgetStatePropertyAll(BorderSide(color: EchoColors.hairline)),
    shape: const WidgetStatePropertyAll(_sharp),
    minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
    padding: const WidgetStatePropertyAll(
      EdgeInsets.symmetric(horizontal: 18, vertical: 12),
    ),
    textStyle: WidgetStatePropertyAll(EchoText.label()),
  );
}

// ── ThemeData ─────────────────────────────────────────────────────────────────

ThemeData buildEchoTheme() {
  const colorScheme = ColorScheme(
    brightness: Brightness.dark,
    primary: EchoColors.signalGreen,
    onPrimary: EchoColors.textHeadline,
    secondary: EchoColors.signalGreenDim,
    onSecondary: EchoColors.textHeadline,
    error: EchoColors.dangerRed,
    onError: EchoColors.textHeadline,
    surface: EchoColors.bgSurface,
    onSurface: EchoColors.textPrimary,
  );

  const fieldBorder = OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(2)),
    borderSide: BorderSide(color: EchoColors.hairline),
  );

  // Gold marks the active nav item — the one selected thing on a screen.
  Color navColor(Set<WidgetState> states) => states.contains(WidgetState.selected)
      ? EchoColors.highlightSelect
      : EchoColors.textMuted;

  return ThemeData(
    colorScheme: colorScheme,
    useMaterial3: true,
    scaffoldBackgroundColor: EchoColors.bgVoid,
    fontFamily: 'NotoSerif',
    textTheme: ThemeData.dark()
        .textTheme
        .apply(
          fontFamily: 'NotoSerif',
          bodyColor: EchoColors.textPrimary,
          displayColor: EchoColors.textHeadline,
        ),
    appBarTheme: AppBarTheme(
      backgroundColor: EchoColors.bgVoid,
      foregroundColor: EchoColors.textSecondary,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: EchoText.headline(size: 20),
      shape: const Border(bottom: BorderSide(color: EchoColors.hairline)),
    ),
    cardTheme: const CardThemeData(
      color: EchoColors.bgSurface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(2)),
        side: BorderSide(color: EchoColors.hairline),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: EchoColors.bgSurface,
      border: fieldBorder,
      enabledBorder: fieldBorder,
      // The focused field is the single focus on screens without a nav bar.
      focusedBorder: fieldBorder.copyWith(
        borderSide: const BorderSide(color: EchoColors.highlightSelect, width: 1.5),
      ),
      labelStyle: EchoText.label(),
      floatingLabelStyle: EchoText.label(),
      hintStyle: EchoText.mono(color: EchoColors.textMuted),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(style: EchoButtonStyles.primary),
    outlinedButtonTheme: OutlinedButtonThemeData(style: EchoButtonStyles.ghost),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: EchoColors.textSecondary,
        textStyle: EchoText.label(),
      ),
    ),
    iconTheme: const IconThemeData(color: EchoColors.textSecondary),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: EchoColors.bgSurface,
      surfaceTintColor: Colors.transparent,
      indicatorColor: Colors.transparent,
      height: 68,
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(color: navColor(states), size: 24),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => EchoText.label(color: navColor(states)),
      ),
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: EchoColors.bgSurface,
      indicatorColor: Colors.transparent,
      selectedIconTheme: const IconThemeData(color: EchoColors.highlightSelect),
      unselectedIconTheme: const IconThemeData(color: EchoColors.textMuted),
      selectedLabelTextStyle: EchoText.label(color: EchoColors.highlightSelect),
      unselectedLabelTextStyle: EchoText.label(color: EchoColors.textMuted),
    ),
    drawerTheme: const DrawerThemeData(
      backgroundColor: EchoColors.bgSurface,
      surfaceTintColor: Colors.transparent,
      shape: _sharp,
    ),
    dataTableTheme: DataTableThemeData(
      headingTextStyle: EchoText.label(),
      dataTextStyle: EchoText.mono(size: 13),
      dividerThickness: 1,
      headingRowHeight: 44,
      dataRowMinHeight: 48,
      dataRowMaxHeight: 52,
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: EchoColors.signalGreenBright,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: EchoColors.bgSurfaceRaised,
      surfaceTintColor: Colors.transparent,
      // A modal counts as its own screen; what is behind it is dimmed.
      barrierColor: EchoColors.shade.withValues(alpha: 0.6),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(2)),
        side: BorderSide(color: EchoColors.hairline),
      ),
      titleTextStyle: EchoText.headline(size: 22),
      contentTextStyle: EchoText.body(),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: EchoColors.bgSurfaceRaised,
      contentTextStyle: EchoText.mono(size: 13),
      actionTextColor: EchoColors.textHeadline,
      behavior: SnackBarBehavior.floating,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(2)),
        side: BorderSide(color: EchoColors.hairline),
      ),
    ),
    dividerTheme: const DividerThemeData(color: EchoColors.hairline, space: 1),
    dividerColor: EchoColors.hairline,
  );
}
