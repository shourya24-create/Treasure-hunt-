/// theme.dart — EchoColors palette and global ThemeData.
library;

import 'package:flutter/material.dart';

// ── Colour palette ─────────────────────────────────────────────────────────────

class EchoColors {
  EchoColors._();

  /// Deep space black — primary background.
  static const background = Color(0xFF0A0E1A);

  /// Panel / card surface.
  static const surface = Color(0xFF12192B);

  /// Elevated card (dialogs, modals).
  static const surfaceHigh = Color(0xFF1C2640);

  /// Cyan accent — interactive elements.
  static const cyan = Color(0xFF00E5FF);

  /// Muted cyan — secondary text, disabled states.
  static const cyanDim = Color(0xFF4DD9F0);

  /// Warning amber.
  static const amber = Color(0xFFFFB300);

  /// Error red.
  static const error = Color(0xFFFF3D5A);

  /// Success green.
  static const success = Color(0xFF00E676);

  /// Primary text — near-white.
  static const textPrimary = Color(0xFFE8EAF6);

  /// Secondary text — muted.
  static const textSecondary = Color(0xFF8892B0);

  /// Divider / border.
  static const divider = Color(0xFF1E2D45);
}

// ── ThemeData ─────────────────────────────────────────────────────────────────

ThemeData buildEchoTheme() {
  const colorScheme = ColorScheme(
    brightness: Brightness.dark,
    primary: EchoColors.cyan,
    onPrimary: EchoColors.background,
    secondary: EchoColors.cyanDim,
    onSecondary: EchoColors.background,
    error: EchoColors.error,
    onError: EchoColors.textPrimary,
    surface: EchoColors.surface,
    onSurface: EchoColors.textPrimary,
  );

  return ThemeData(
    colorScheme: colorScheme,
    useMaterial3: true,
    scaffoldBackgroundColor: EchoColors.background,
    fontFamily: 'monospace',
    appBarTheme: const AppBarTheme(
      backgroundColor: EchoColors.background,
      foregroundColor: EchoColors.textPrimary,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        color: EchoColors.cyan,
        fontSize: 18,
        fontWeight: FontWeight.w600,
        letterSpacing: 2,
      ),
    ),
    cardTheme: CardTheme(
      color: EchoColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: EchoColors.divider),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: EchoColors.surfaceHigh,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: EchoColors.divider),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: EchoColors.divider),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: EchoColors.cyan, width: 1.5),
      ),
      labelStyle: const TextStyle(color: EchoColors.textSecondary),
      hintStyle: const TextStyle(color: EchoColors.textSecondary),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: EchoColors.cyan,
        foregroundColor: EchoColors.background,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        textStyle: const TextStyle(
          fontWeight: FontWeight.w700,
          letterSpacing: 1.5,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: EchoColors.cyan),
    ),
    dividerColor: EchoColors.divider,
    textTheme: const TextTheme(
      headlineLarge: TextStyle(color: EchoColors.textPrimary, fontWeight: FontWeight.w700),
      headlineMedium: TextStyle(color: EchoColors.textPrimary, fontWeight: FontWeight.w600),
      titleLarge: TextStyle(color: EchoColors.textPrimary, fontWeight: FontWeight.w600),
      titleMedium: TextStyle(color: EchoColors.cyan, letterSpacing: 1.2),
      bodyLarge: TextStyle(color: EchoColors.textPrimary),
      bodyMedium: TextStyle(color: EchoColors.textSecondary),
      labelLarge: TextStyle(color: EchoColors.textPrimary, fontWeight: FontWeight.w600),
    ),
  );
}
