import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// A simplified, static stand-in for the website's animated aurora-gradient
/// background (components/digit/aurora-background.tsx) used behind the
/// marketing/auth pages. Per the founder's brief, a literal animation is a
/// nice-to-have for v1 -- this renders soft, fixed radial glows in the
/// TRIAD colors over the dark background instead of animating them.
class AuroraBackground extends StatelessWidget {
  const AuroraBackground({super.key});

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: DecoratedBox(
        decoration: const BoxDecoration(color: AppColors.background),
        child: Stack(
          children: [
            _glow(
              alignment: const Alignment(-0.9, -1.0),
              color: AppColors.triad[0],
              size: 320,
            ),
            _glow(
              alignment: const Alignment(1.0, -0.4),
              color: AppColors.triad[1],
              size: 280,
            ),
            _glow(
              alignment: const Alignment(-0.6, 1.0),
              color: AppColors.triad[2],
              size: 300,
            ),
          ],
        ),
      ),
    );
  }

  Widget _glow({
    required Alignment alignment,
    required Color color,
    required double size,
  }) {
    return Align(
      alignment: alignment,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color.withValues(alpha: 0.20),
              color.withValues(alpha: 0.0),
            ],
          ),
        ),
      ),
    );
  }
}
