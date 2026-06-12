import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Palette ported from the web app's CSS variables (HSL -> hex).
class AppColors {
  AppColors._();

  static const background = Color(0xFFF5F3F0); // --background
  static const surface = Colors.white; // --card / --surface
  static const surfaceAlt = Color(0xFFEDE8DF); // --surface-2
  static const ink = Color(0xFF0A0E19); // --foreground
  static const inkDeep = Color(0xFF06080D); // --ink
  static const accent = Color(0xFFF6A41F); // --primary / --accent
  static const muted = Color(0xFFE8E4DD); // --muted
  static const mutedForeground = Color(0xFF5A6578); // --muted-foreground
  static const border = Color(0xFFC9C3B8); // --border
  static const danger = Color(0xFFDC2626); // --destructive
  static const success = Color(0xFF15803D); // --success
  static const reservedSeat = Color(0xFFE4E4E7); // zinc-200
  static const reservedSeatText = Color(0xFFA1A1AA); // zinc-400
}

ThemeData buildAppTheme() {
  const scheme = ColorScheme.light(
    primary: AppColors.accent,
    onPrimary: AppColors.inkDeep,
    secondary: AppColors.inkDeep,
    onSecondary: Colors.white,
    surface: AppColors.surface,
    onSurface: AppColors.ink,
    error: AppColors.danger,
    onError: Colors.white,
    outline: AppColors.border,
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme);
  final textTheme = GoogleFonts.interTextTheme(
    base.textTheme,
  ).apply(bodyColor: AppColors.ink, displayColor: AppColors.ink);

  return base.copyWith(
    scaffoldBackgroundColor: AppColors.background,
    textTheme: textTheme,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      foregroundColor: AppColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: AppColors.ink,
        fontSize: 18,
        fontWeight: FontWeight.w800,
      ),
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border, width: 0.8),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      hintStyle: const TextStyle(
        color: AppColors.mutedForeground,
        fontSize: 14,
      ),
      labelStyle: const TextStyle(
        color: AppColors.mutedForeground,
        fontSize: 14,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.accent, width: 1.6),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.danger),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.accent,
        foregroundColor: AppColors.inkDeep,
        minimumSize: const Size(64, 48),
        textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.inkDeep,
        foregroundColor: Colors.white,
        elevation: 0,
        minimumSize: const Size(64, 48),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.ink,
        side: const BorderSide(color: AppColors.border),
        minimumSize: const Size(64, 46),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.ink,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: AppColors.surface,
      side: const BorderSide(color: AppColors.border),
      labelStyle: const TextStyle(
        color: AppColors.ink,
        fontSize: 13,
        fontWeight: FontWeight.w600,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.surface,
      indicatorColor: AppColors.accent.withValues(alpha: 0.22),
      surfaceTintColor: Colors.transparent,
      height: 68,
      labelTextStyle: WidgetStatePropertyAll(
        const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: AppColors.ink,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 24,
          color: states.contains(WidgetState.selected)
              ? AppColors.inkDeep
              : AppColors.mutedForeground,
        ),
      ),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.muted, thickness: 1),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.inkDeep,
      contentTextStyle: const TextStyle(color: Colors.white, fontSize: 14),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppColors.accent,
    ),
  );
}
