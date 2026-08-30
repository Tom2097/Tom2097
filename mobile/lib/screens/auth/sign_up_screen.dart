import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/api_client.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/aurora_background.dart';
import '../../widgets/digit_logo.dart';
import '../../widgets/google_button.dart';
import '../home/home_shell.dart';
import 'sign_up_success_screen.dart';

/// Password strength scoring, ported 1:1 from
/// app/auth/sign-up/page.tsx's `getPasswordStrength()`: one point each for
/// length >= 8, an uppercase letter, a lowercase letter, a number, and a
/// special character. The website blocks submission below a score of 3;
/// this does the same. (The server in app/api/auth/sign-up/route.ts is
/// actually stricter -- it requires all five checks to pass -- but this
/// matches the client-side rule the website's UI enforces before it ever
/// calls the server.)
class _PasswordStrength {
  _PasswordStrength(String password) {
    length = password.length >= 8;
    uppercase = RegExp(r'[A-Z]').hasMatch(password);
    lowercase = RegExp(r'[a-z]').hasMatch(password);
    number = RegExp(r'[0-9]').hasMatch(password);
    special = RegExp(r'[^A-Za-z0-9]').hasMatch(password);
    score = [length, uppercase, lowercase, number, special]
        .where((c) => c)
        .length;

    if (score >= 5) {
      label = 'Very strong';
      color = AppColors.green;
    } else if (score >= 4) {
      label = 'Strong';
      color = AppColors.green;
    } else if (score >= 3) {
      label = 'Fair';
      color = Colors.amber;
    } else if (score >= 2) {
      label = 'Weak';
      color = Colors.orange;
    } else {
      label = 'Very weak';
      color = AppColors.destructive;
    }
  }

  late final bool length;
  late final bool uppercase;
  late final bool lowercase;
  late final bool number;
  late final bool special;
  late final int score;
  late final String label;
  late final Color color;
}

/// Matches app/auth/sign-up/page.tsx: full name, company name, email,
/// password (with strength meter), confirm password, and "Continue with
/// Google".
class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _companyNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;
  bool _isGoogleLoading = false;
  String? _error;
  String _password = '';
  String _confirmPassword = '';

  @override
  void dispose() {
    _fullNameController.dispose();
    _companyNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _signUp() async {
    if (!_formKey.currentState!.validate()) return;

    if (_password != _confirmPassword) {
      setState(() => _error = 'Passwords do not match');
      return;
    }

    final strength = _PasswordStrength(_password);
    if (strength.score < 3) {
      setState(() => _error = 'Please choose a stronger password');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await AuthService.signUp(
        email: _emailController.text.trim(),
        password: _password,
        fullName: _fullNameController.text.trim(),
        companyName: _companyNameController.text.trim(),
      );

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => SignUpSuccessScreen(email: _emailController.text.trim()),
        ),
      );
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to create account');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _signUpWithGoogle() async {
    setState(() {
      _isGoogleLoading = true;
      _error = null;
    });
    try {
      final response = await AuthService.signInWithGoogle();
      if (response.session == null) {
        throw const AuthException('Google sign-up failed. Please try again.');
      }

      // Mirrors app/api/auth/google-post-signin/route.ts on the web: creates
      // the organization/profile for this brand-new user.
      await ApiClient.post('/api/auth/google-post-signin');

      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeShell()),
        (route) => false,
      );
    } on GoogleSignInException catch (e) {
      if (e.code != GoogleSignInExceptionCode.canceled) {
        setState(() => _error = 'Google sign-up failed. Please try again.');
      }
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Google sign-up failed. Please try again.');
    } finally {
      if (mounted) setState(() => _isGoogleLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strength = _PasswordStrength(_password);
    final passwordsMatch = _confirmPassword.isNotEmpty && _password == _confirmPassword;
    final passwordsMismatch = _confirmPassword.isNotEmpty && _password != _confirmPassword;

    return Scaffold(
      body: Stack(
        children: [
          const AuroraBackground(),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Center(child: DigitLogo(size: 48)),
                            const SizedBox(height: 20),
                            Text(
                              'Create your account',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Start your free trial — no credit card required',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: AppColors.mutedForeground,
                                  ),
                            ),
                            const SizedBox(height: 24),
                            if (_error != null) ...[
                              _ErrorBanner(message: _error!),
                              const SizedBox(height: 16),
                            ],
                            GoogleButton(
                              isLoading: _isGoogleLoading,
                              onPressed: _signUpWithGoogle,
                              label: _isGoogleLoading
                                  ? 'Creating account...'
                                  : 'Continue with Google',
                            ),
                            const SizedBox(height: 20),
                            Row(
                              children: [
                                const Expanded(child: Divider()),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8),
                                  child: Text(
                                    'OR SIGN UP WITH EMAIL',
                                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                          color: AppColors.mutedForeground,
                                        ),
                                  ),
                                ),
                                const Expanded(child: Divider()),
                              ],
                            ),
                            const SizedBox(height: 20),
                            const _FieldLabel('Full name'),
                            TextFormField(
                              controller: _fullNameController,
                              autofillHints: const [AutofillHints.name],
                              decoration: const InputDecoration(hintText: 'Jane Doe'),
                              validator: (v) =>
                                  (v == null || v.trim().isEmpty) ? 'Full name is required' : null,
                            ),
                            const SizedBox(height: 16),
                            const _FieldLabel('Company name'),
                            TextFormField(
                              controller: _companyNameController,
                              decoration: const InputDecoration(hintText: 'Acme Inc.'),
                              validator: (v) =>
                                  (v == null || v.trim().isEmpty) ? 'Company name is required' : null,
                            ),
                            const SizedBox(height: 16),
                            const _FieldLabel('Email'),
                            TextFormField(
                              controller: _emailController,
                              keyboardType: TextInputType.emailAddress,
                              autofillHints: const [AutofillHints.email],
                              decoration: const InputDecoration(hintText: 'you@company.com'),
                              validator: (v) =>
                                  (v == null || v.trim().isEmpty) ? 'Email is required' : null,
                            ),
                            const SizedBox(height: 16),
                            const _FieldLabel('Password'),
                            TextFormField(
                              controller: _passwordController,
                              obscureText: _obscurePassword,
                              autofillHints: const [AutofillHints.newPassword],
                              onChanged: (v) => setState(() => _password = v),
                              decoration: InputDecoration(
                                hintText: 'Create a password',
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    color: AppColors.mutedForeground,
                                  ),
                                  onPressed: () =>
                                      setState(() => _obscurePassword = !_obscurePassword),
                                ),
                              ),
                              validator: (v) {
                                if (v == null || v.length < 8) {
                                  return 'Password must be at least 8 characters';
                                }
                                return null;
                              },
                            ),
                            if (_password.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              Row(
                                children: List.generate(5, (i) {
                                  final filled = i < strength.score;
                                  return Expanded(
                                    child: Container(
                                      margin: EdgeInsets.only(right: i == 4 ? 0 : 4),
                                      height: 4,
                                      decoration: BoxDecoration(
                                        color: filled ? strength.color : AppColors.secondarySurface,
                                        borderRadius: BorderRadius.circular(2),
                                      ),
                                    ),
                                  );
                                }),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                strength.label,
                                style: TextStyle(fontSize: 12, color: strength.color),
                              ),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 12,
                                runSpacing: 4,
                                children: [
                                  _Requirement('At least 8 characters', strength.length),
                                  _Requirement('One uppercase letter', strength.uppercase),
                                  _Requirement('One lowercase letter', strength.lowercase),
                                  _Requirement('One number', strength.number),
                                  _Requirement('One special character', strength.special),
                                ],
                              ),
                            ],
                            const SizedBox(height: 16),
                            const _FieldLabel('Confirm password'),
                            TextFormField(
                              controller: _confirmPasswordController,
                              obscureText: _obscureConfirmPassword,
                              onChanged: (v) => setState(() => _confirmPassword = v),
                              decoration: InputDecoration(
                                hintText: 'Re-enter your password',
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscureConfirmPassword
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    color: AppColors.mutedForeground,
                                  ),
                                  onPressed: () => setState(
                                      () => _obscureConfirmPassword = !_obscureConfirmPassword),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: BorderSide(
                                    color: passwordsMatch
                                        ? AppColors.green.withValues(alpha: 0.5)
                                        : passwordsMismatch
                                            ? AppColors.destructive.withValues(alpha: 0.5)
                                            : AppColors.border,
                                  ),
                                ),
                              ),
                              validator: (v) {
                                if (v == null || v.isEmpty) return 'Please confirm your password';
                                if (v != _password) return 'Passwords do not match';
                                return null;
                              },
                            ),
                            if (passwordsMatch)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Row(
                                  children: [
                                    const Icon(Icons.check, size: 14, color: AppColors.green),
                                    const SizedBox(width: 4),
                                    const Text('Passwords match',
                                        style: TextStyle(fontSize: 12, color: AppColors.green)),
                                  ],
                                ),
                              ),
                            const SizedBox(height: 24),
                            ElevatedButton(
                              onPressed: (_isLoading || passwordsMismatch) ? null : _signUp,
                              child: _isLoading
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.5,
                                        color: AppColors.background,
                                      ),
                                    )
                                  : const Text('Start free trial'),
                            ),
                            const SizedBox(height: 16),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.shield_outlined,
                                    size: 14, color: AppColors.mutedForeground),
                                const SizedBox(width: 6),
                                Text(
                                  'Your data is encrypted and secure',
                                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                        color: AppColors.mutedForeground,
                                      ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Already have an account?',
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                        color: AppColors.mutedForeground,
                                      ),
                                ),
                                TextButton(
                                  onPressed: () => Navigator.of(context).pop(),
                                  child: const Text('Sign in',
                                      style: TextStyle(fontWeight: FontWeight.w600)),
                                ),
                              ],
                            ),
                            Text(
                              'By signing up, you agree to our Terms of Service and Privacy Policy',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: AppColors.mutedForeground,
                                  ),
                            ),
                          ],
                        ),
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

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(color: AppColors.foreground),
      ),
    );
  }
}

class _Requirement extends StatelessWidget {
  const _Requirement(this.label, this.met);
  final String label;
  final bool met;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          met ? Icons.check : Icons.close,
          size: 12,
          color: met ? AppColors.green : AppColors.mutedForeground.withValues(alpha: 0.5),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: met ? AppColors.green : AppColors.mutedForeground.withValues(alpha: 0.5),
          ),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.destructive.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.destructive.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, size: 18, color: AppColors.destructive),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: AppColors.destructive, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
