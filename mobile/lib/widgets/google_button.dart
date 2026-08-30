import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// "Continue with Google" button matching the website's outline button
/// (components/auth/google-icon.tsx + the Button variant="outline" used on
/// both app/auth/login/page.tsx and app/auth/sign-up/page.tsx).
///
/// Tapping this calls AuthService.signInWithGoogle(), which uses the native
/// account picker (see lib/services/auth_service.dart). Requires the
/// Android/iOS OAuth clients described there to exist in Google Cloud
/// Console -- until then, authenticate() fails with a
/// GoogleSignInException (usually clientConfigurationError).
class GoogleButton extends StatelessWidget {
  const GoogleButton({
    super.key,
    required this.onPressed,
    required this.isLoading,
    required this.label,
  });

  final VoidCallback? onPressed;
  final bool isLoading;
  final String label;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: isLoading ? null : onPressed,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (isLoading)
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            const _GoogleG(),
          const SizedBox(width: 12),
          Text(label),
        ],
      ),
    );
  }
}

/// Minimal multi-color Google "G" glyph so the button doesn't depend on a
/// bundled icon asset.
class _GoogleG extends StatelessWidget {
  const _GoogleG();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 18,
      height: 18,
      child: Icon(Icons.g_mobiledata_rounded, size: 22, color: AppColors.foreground),
    );
  }
}
