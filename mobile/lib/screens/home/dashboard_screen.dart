import 'dart:convert';

import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../auth/login_screen.dart';

/// The proof-of-life screen for this whole scaffold: it calls the real
/// Next.js backend's `GET /api/v1/billing/trials` with the current
/// Supabase session's access token attached as a Bearer header (see
/// `ApiClient`), and renders whatever comes back. If this screen shows a
/// real JSON body (not a network/auth error), the full chain -- Flutter ->
/// Supabase auth -> Bearer token -> Next.js API -> Supabase (service role)
/// -- is proven end-to-end.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _isLoading = true;
  String? _error;
  Object? _result;

  @override
  void initState() {
    super.initState();
    _loadTrials();
  }

  Future<void> _loadTrials() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await ApiClient.get('/api/v1/billing/trials');
      setState(() => _result = result);
    } on ApiException catch (e) {
      setState(() => _error = '${e.statusCode}: ${e.message}');
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _logout() async {
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
    final encoder = const JsonEncoder.withIndent('  ');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: _logout,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadTrials,
        color: AppColors.primary,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.person_outline, color: AppColors.primary),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Signed in',
                            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                  color: AppColors.mutedForeground,
                                ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            user?.email ?? 'Unknown user',
                            style: Theme.of(context).textTheme.titleMedium,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Text('GET /api/v1/billing/trials', style: Theme.of(context).textTheme.titleSmall),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.refresh, size: 20),
                  onPressed: _isLoading ? null : _loadTrials,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: _isLoading
                    ? const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    : _error != null
                        ? Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.error_outline,
                                  color: AppColors.destructive, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _error!,
                                  style: const TextStyle(color: AppColors.destructive),
                                ),
                              ),
                            ],
                          )
                        : SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Text(
                              encoder.convert(_result),
                              style: AppTheme.monoTextStyle(fontSize: 12.5),
                            ),
                          ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
