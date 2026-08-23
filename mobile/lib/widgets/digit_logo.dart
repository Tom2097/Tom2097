import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Mirrors components/digit/logo.tsx's mark: a glowing cyan square with the
/// wordmark next to it.
class DigitLogo extends StatelessWidget {
  const DigitLogo({super.key, this.size = 40});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(size * 0.28),
            border: Border.all(color: AppColors.border),
            boxShadow: digitGlow(opacity: 0.35, blurRadius: size * 0.5),
          ),
          child: Icon(
            Icons.bolt_rounded,
            color: AppColors.primary,
            size: size * 0.55,
          ),
        ),
        SizedBox(width: size * 0.3),
        Text(
          'DigiT',
          style: TextStyle(
            fontSize: size * 0.5,
            fontWeight: FontWeight.w700,
            color: AppColors.foreground,
          ),
        ),
      ],
    );
  }
}
