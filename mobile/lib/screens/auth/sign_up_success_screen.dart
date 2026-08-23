import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import '../../widgets/aurora_background.dart';
import 'login_screen.dart';

/// Matches app/auth/sign-up-success/page.tsx's copy: signup requires email
/// verification before a session exists, so this is the terminal state of
/// the sign-up flow for v1 (the user backs out to login after verifying).
class SignUpSuccessScreen extends StatelessWidget {
  const SignUpSuccessScreen({super.key, required this.email});

  final String email;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const AuroraBackground(),
          SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(28),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: AppColors.green.withValues(alpha: 0.1),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.mark_email_read_outlined,
                                color: AppColors.green, size: 28),
                          ),
                          const SizedBox(height: 20),
                          Text('Check your email',
                              style: Theme.of(context).textTheme.headlineSmall),
                          const SizedBox(height: 12),
                          Text(
                            'We sent a confirmation link to $email.',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: AppColors.mutedForeground,
                                ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            "Click the link in that email to activate your account. "
                            "If you don't see it in a minute or two, check your spam folder.",
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppColors.mutedForeground,
                                ),
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton(
                            onPressed: () => Navigator.of(context).pushAndRemoveUntil(
                              MaterialPageRoute(builder: (_) => const LoginScreen()),
                              (route) => false,
                            ),
                            child: const Text('Back to sign in'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
