import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../services/auth_service.dart';
import '../../services/push_service.dart';
import '../../theme/app_theme.dart';
import '../auth/login_screen.dart';

/// Real account info (from the Supabase session, no extra API call needed)
/// and a working sign-out -- the same action Dashboard's AppBar icon
/// performs, just where a user actually expects to find it.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  PackageInfo? _packageInfo;

  @override
  void initState() {
    super.initState();
    PackageInfo.fromPlatform().then((info) {
      if (mounted) setState(() => _packageInfo = info);
    });
  }

  Future<void> _confirmSignOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text("You'll need to sign in again to access your account."),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    await PushService.unregisterDevice();
    await AuthService.signOut();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService.currentSession?.user;
    final fullName = user?.userMetadata?['full_name'] as String?;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        _initials(fullName, user?.email),
                        style: const TextStyle(
                          color: AppColors.background,
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (fullName == null || fullName.isEmpty) ? 'Your account' : fullName,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          user?.email ?? 'Unknown',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppColors.mutedForeground,
                              ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          _SectionLabel('Account'),
          Card(
            child: Column(
              children: [
                _SettingsRow(
                  icon: Icons.mail_outline,
                  label: 'Email',
                  value: user?.email ?? '—',
                ),
                const Divider(height: 1),
                _SettingsRow(
                  icon: Icons.badge_outlined,
                  label: 'User ID',
                  value: user?.id ?? '—',
                  monospace: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _SectionLabel('About'),
          Card(
            child: _SettingsRow(
              icon: Icons.info_outline,
              label: 'Version',
              value: _packageInfo == null
                  ? '—'
                  : '${_packageInfo!.version} (${_packageInfo!.buildNumber})',
            ),
          ),
          const SizedBox(height: 32),
          OutlinedButton.icon(
            onPressed: _confirmSignOut,
            icon: const Icon(Icons.logout, color: AppColors.destructive),
            label: const Text('Sign out', style: TextStyle(color: AppColors.destructive)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.destructive),
              minimumSize: const Size.fromHeight(48),
            ),
          ),
        ],
      ),
    );
  }

  static String _initials(String? fullName, String? email) {
    if (fullName != null && fullName.trim().isNotEmpty) {
      final parts = fullName.trim().split(RegExp(r'\s+'));
      final first = parts.first.characters.first;
      final last = parts.length > 1 ? parts.last.characters.first : '';
      return (first + last).toUpperCase();
    }
    if (email != null && email.isNotEmpty) return email.characters.first.toUpperCase();
    return '?';
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        text.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: AppColors.mutedForeground,
              letterSpacing: 1.0,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.icon,
    required this.label,
    required this.value,
    this.monospace = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool monospace;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.mutedForeground),
          const SizedBox(width: 14),
          Expanded(
            child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              overflow: TextOverflow.ellipsis,
              style: monospace
                  ? AppTheme.monoTextStyle(fontSize: 12.5, color: AppColors.mutedForeground)
                  : Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.mutedForeground,
                      ),
            ),
          ),
        ],
      ),
    );
  }
}
