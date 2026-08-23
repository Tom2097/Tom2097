import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// DigiT's brand palette, converted 1:1 from the website's oklch design
/// tokens (see `styles/globals.css` in the web app) to hex. Keep this file
/// as the single source of truth for color -- screens should reference
/// `Theme.of(context)` / [AppColors] rather than hardcoding hex values.
class AppColors {
  AppColors._();

  static const background = Color(0xFF02060F); // near-black navy
  static const surface = Color(0xFF080D16); // card/surface
  static const foreground = Color(0xFFF6F9FB); // primary text
  static const secondarySurface = Color(0xFF151B24); // secondary surface
  static const mutedForeground = Color(0xFF85919A); // muted/secondary text
  static const border = Color(0xFF222935);
  static const destructive = Color(0xFFD40924);

  /// The website's `TRIAD` constant (components/digit/landing-page.tsx),
  /// in this exact order. `triad[0]` (cyan) is the primary brand accent and
  /// doubles as Flutter's ColorScheme.primary; the rest are cycled through
  /// for icons/module colors/highlights the same way the website does.
  static const triad = <Color>[
    Color(0xFF3CE0E2), // cyan/teal -- primary brand accent
    Color(0xFF3B7CF5), // blue
    Color(0xFF00C875), // green
  ];

  static const primary = Color(0xFF3CE0E2);
  static const blue = Color(0xFF3B7CF5);
  static const green = Color(0xFF00C875);

  /// Returns triad[index % triad.length], matching the website's
  /// `TRIAD[i % TRIAD.length]` cycling behavior for repeated module/icon
  /// colors.
  static Color triadAt(int index) => triad[index % triad.length];
}

/// Approximates the website's "digit-glow" effect: a soft cyan glow/shadow
/// around primary buttons and highlighted/active surfaces.
List<BoxShadow> digitGlow({double opacity = 0.35, double blurRadius = 24}) {
  return [
    BoxShadow(
      color: AppColors.primary.withValues(alpha: opacity),
      blurRadius: blurRadius,
      spreadRadius: 0,
    ),
  ];
}

class AppTheme {
  AppTheme._();

  // NOTE (Geist font): the website uses Vercel's "Geist" / "Geist Mono"
  // typefaces. As of this build, the `google_fonts` package does not ship
  // Geist (verified against the installed google_fonts 6.x asset manifest --
  // no `geist` entry exists), so this substitutes Google Fonts' "Inter" as
  // the closest widely-available geometric grotesk alternative. Swap
  // `GoogleFonts.inter` for `GoogleFonts.geist` here (and in
  // [monoTextTheme]) the moment the package adds it.
  static TextTheme _textTheme(TextTheme base) => GoogleFonts.interTextTheme(
        base,
      ).apply(
        bodyColor: AppColors.foreground,
        displayColor: AppColors.foreground,
      );

  /// Monospace/numeric contexts (matching the website's "Geist Mono" usage,
  /// e.g. numbers, ids, code). Falls back to `GoogleFonts.robotoMono` since
  /// Geist Mono isn't available in `google_fonts` either.
  static TextStyle monoTextStyle({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
  }) =>
      GoogleFonts.robotoMono(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color ?? AppColors.foreground,
      );

  static ThemeData get dark {
    final base = ThemeData.dark(useMaterial3: true);
    final colorScheme = const ColorScheme.dark(
      brightness: Brightness.dark,
      primary: AppColors.primary,
      onPrimary: AppColors.background,
      secondary: AppColors.blue,
      onSecondary: AppColors.foreground,
      tertiary: AppColors.green,
      onTertiary: AppColors.background,
      surface: AppColors.surface,
      onSurface: AppColors.foreground,
      error: AppColors.destructive,
      onError: AppColors.foreground,
      outline: AppColors.border,
    );

    return base.copyWith(
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,
      canvasColor: AppColors.background,
      textTheme: _textTheme(base.textTheme),
      primaryTextTheme: _textTheme(base.primaryTextTheme),
      dividerColor: AppColors.border,
      splashColor: AppColors.primary.withValues(alpha: 0.08),
      highlightColor: AppColors.primary.withValues(alpha: 0.04),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.foreground,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.inter(
          color: AppColors.foreground,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
        iconTheme: const IconThemeData(color: AppColors.foreground),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.secondarySurface.withValues(alpha: 0.5),
        hintStyle: GoogleFonts.inter(color: AppColors.mutedForeground),
        labelStyle: GoogleFonts.inter(color: AppColors.mutedForeground),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.destructive),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.destructive, width: 1.5),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.background,
          disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.35),
          disabledForegroundColor: AppColors.background.withValues(alpha: 0.6),
          minimumSize: const Size.fromHeight(48),
          textStyle: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.foreground,
          minimumSize: const Size.fromHeight(48),
          side: const BorderSide(color: AppColors.border),
          textStyle: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: GoogleFonts.inter(fontWeight: FontWeight.w500),
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.primary;
          }
          return Colors.transparent;
        }),
        checkColor: const WidgetStatePropertyAll(AppColors.background),
        side: const BorderSide(color: AppColors.border),
      ),
      iconTheme: const IconThemeData(color: AppColors.foreground),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.mutedForeground,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: GoogleFonts.inter(
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: GoogleFonts.inter(fontSize: 12),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.secondarySurface,
        contentTextStyle: GoogleFonts.inter(color: AppColors.foreground),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primary,
      ),
    );
  }
}
