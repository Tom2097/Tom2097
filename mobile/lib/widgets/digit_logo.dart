import 'package:flutter/material.dart';

/// Faithful recreation of components/digit/logo.tsx's actual mark -- not a
/// generic icon substitute. The website's LogoMark is an SVG: a 100x100
/// rounded-rect (rx=24) filled with a diagonal teal gradient (#3ce0e2 ->
/// #00a3a8), a bold dark "D" positioned left-of-center, and a small dark
/// square "cursor dot" at the bottom-right -- read directly from that file
/// rather than approximated.
class DigitLogoMark extends StatelessWidget {
  const DigitLogoMark({super.key, this.size = 40});

  final double size;

  static const _markDark = Color(0xFF052426);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF3CE0E2), Color(0xFF00A3A8)],
        ),
      ),
      child: Stack(
        children: [
          Align(
            alignment: const Alignment(-0.25, 0.2),
            child: Text(
              'D',
              style: TextStyle(
                fontSize: size * 0.58,
                fontWeight: FontWeight.w800,
                height: 1,
                color: _markDark,
              ),
            ),
          ),
          Positioned(
            right: size * 0.2,
            bottom: size * 0.28,
            child: Container(
              width: size * 0.14,
              height: size * 0.14,
              decoration: BoxDecoration(
                color: _markDark,
                borderRadius: BorderRadius.circular(size * 0.03),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Full lockup: mark + "DigiT" wordmark (+ optional "ENTERPRISE
/// INTELLIGENCE" sub-label), matching Logo (not just LogoIcon) from the
/// website's logo.tsx.
class DigitLogo extends StatelessWidget {
  const DigitLogo({super.key, this.size = 40, this.showSubtitle = true});

  final double size;
  final bool showSubtitle;

  @override
  Widget build(BuildContext context) {
    final foreground = Theme.of(context).colorScheme.onSurface;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        DigitLogoMark(size: size),
        SizedBox(width: size * 0.32),
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'DigiT',
              style: TextStyle(
                fontSize: size * 0.58,
                fontWeight: FontWeight.w800,
                color: foreground,
                height: 1,
              ),
            ),
            if (showSubtitle) ...[
              SizedBox(height: size * 0.06),
              Text(
                'ENTERPRISE INTELLIGENCE',
                style: TextStyle(
                  fontSize: size * 0.16,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 1.2,
                  color: foreground.withValues(alpha: 0.5),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}
