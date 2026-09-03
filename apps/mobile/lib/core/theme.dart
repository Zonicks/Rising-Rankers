import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Design tokens — Rising Rankers (royal blue, gold, navy) + Stitch dual type
class AppColors {
  static const bg = Color(0xFFF7F9FB);
  static const bgElevated = Color(0xFFFFFFFF);
  static const bgLow = Color(0xFFF2F4F6);
  static const bgHigh = Color(0xFFE0E3E5);
  static const ink = Color(0xFF191C1E);
  static const inkSoft = Color(0xFF454652);
  static const muted = Color(0xFF767683);
  static const line = Color(0xFFC6C5D4);
  static const lineStrong = Color(0xFFD0D4DB);
  static const accent = Color(0xFF1E4FC4);
  static const accentSoft = Color(0xFFE7EEFB);
  static const accentHover = Color(0xFF173FA0);
  static const danger = Color(0xFFB42318);
  static const dangerSoft = Color(0xFFFEF3F2);
  static const success = Color(0xFF027A48);
  static const successSoft = Color(0xFFECFDF3);
  static const gold = Color(0xFFF0C21A);
  static const goldSoft = Color(0xFFFBF6DC);
  static const mint = Color(0xFF4EDEA3);
  static const deep = Color(0xFF050B18);
  static const deepMid = Color(0xFF0C1B3D);
}

class AppRadii {
  static const sm = 8.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
  static const hero = 48.0;
}

class AppShadows {
  static final card = [
    BoxShadow(
      color: AppColors.ink.withValues(alpha: 0.05),
      blurRadius: 24,
      offset: const Offset(0, 10),
    ),
  ];
  static final lift = [
    BoxShadow(
      color: AppColors.accent.withValues(alpha: 0.16),
      blurRadius: 28,
      offset: const Offset(0, 14),
    ),
  ];
}

class AppTheme {
  static const brandName = 'Rising Rankers';
  static const brandTagline = 'Rise. Rank. Earn.';

  static TextStyle _manrope({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? height,
    double? letterSpacing,
  }) {
    return GoogleFonts.manrope(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      letterSpacing: letterSpacing ?? -0.4,
    );
  }

  static TextStyle _inter({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? height,
    double? letterSpacing,
  }) {
    return GoogleFonts.inter(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }

  static ThemeData light() {
    final textTheme = TextTheme(
      displayLarge: _manrope(fontSize: 40, fontWeight: FontWeight.w800, height: 1.1, color: AppColors.ink),
      displayMedium: _manrope(fontSize: 32, fontWeight: FontWeight.w800, height: 1.15, color: AppColors.ink),
      headlineLarge: _manrope(fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.ink),
      headlineMedium: _manrope(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.ink),
      headlineSmall: _manrope(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.ink),
      titleLarge: _manrope(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.ink),
      titleMedium: _manrope(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.ink),
      bodyLarge: _inter(fontSize: 16, fontWeight: FontWeight.w400, height: 1.5, color: AppColors.ink),
      bodyMedium: _inter(fontSize: 14, fontWeight: FontWeight.w400, height: 1.5, color: AppColors.inkSoft),
      bodySmall: _inter(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.muted),
      labelLarge: _inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.ink, letterSpacing: 0.4),
      labelMedium: _inter(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.4,
        color: AppColors.muted,
      ),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.bg,
      colorScheme: const ColorScheme.light(
        primary: AppColors.accent,
        onPrimary: Colors.white,
        surface: AppColors.bgElevated,
        onSurface: AppColors.ink,
        outline: AppColors.line,
        error: AppColors.danger,
      ),
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        titleTextStyle: textTheme.titleLarge,
      ),
      dividerTheme: DividerThemeData(color: AppColors.line.withValues(alpha: 0.15), thickness: 1, space: 1),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.bgHigh,
          disabledForegroundColor: AppColors.muted,
          minimumSize: const Size.fromHeight(52),
          elevation: 0,
          shadowColor: Colors.transparent,
          textStyle: _inter(fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 0.8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.accent,
          backgroundColor: AppColors.bgHigh,
          minimumSize: const Size.fromHeight(52),
          side: BorderSide.none,
          textStyle: _inter(fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 0.8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.accent,
          textStyle: _inter(fontSize: 14, fontWeight: FontWeight.w700),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.bgElevated,
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
        hintStyle: _inter(fontSize: 15, color: AppColors.muted),
        labelStyle: _inter(fontSize: 14, color: AppColors.inkSoft),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: AppColors.line.withValues(alpha: 0.15)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: AppColors.line.withValues(alpha: 0.15)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.accent),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.deep,
        contentTextStyle: _inter(fontSize: 14, color: AppColors.gold, fontWeight: FontWeight.w700),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
    );
  }
}
