import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import '../../services/push_service.dart';
import '../../theme/app_theme.dart';
import '../auth/login_screen.dart';
import 'analytics_screen.dart';
import 'compliance_screen.dart';
import 'crm_screen.dart';
import 'feedback_screen.dart';
import 'operations_screen.dart';
import 'performance_screen.dart';
import 'resources_screen.dart';

class _Module {
  const _Module({required this.icon, required this.label, required this.description, required this.builder});

  final IconData icon;
  final String label;
  final String description;
  final WidgetBuilder builder;
}

/// Home hub: account summary + a grid of real product modules. New modules
/// get added here rather than to the bottom nav, which doesn't scale past
/// a handful of tabs.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  static final _modules = <_Module>[
    _Module(
      icon: Icons.people_alt_outlined,
      label: 'CRM',
      description: 'Pipeline & deals',
      builder: (_) => const CrmScreen(),
    ),
    _Module(
      icon: Icons.monitor_heart_outlined,
      label: 'Operations',
      description: 'Monitors & incidents',
      builder: (_) => const OperationsScreen(),
    ),
    _Module(
      icon: Icons.track_changes_outlined,
      label: 'Performance',
      description: 'Objectives & key results',
      builder: (_) => const PerformanceScreen(),
    ),
    _Module(
      icon: Icons.folder_outlined,
      label: 'Resources',
      description: 'Documents & knowledge base',
      builder: (_) => const ResourcesScreen(),
    ),
    _Module(
      icon: Icons.verified_outlined,
      label: 'Compliance',
      description: 'Scores & CAPA records',
      builder: (_) => const ComplianceScreen(),
    ),
    _Module(
      icon: Icons.forum_outlined,
      label: 'Feedback',
      description: 'Requests, bugs & votes',
      builder: (_) => const FeedbackScreen(),
    ),
    _Module(
      icon: Icons.insights_outlined,
      label: 'AI Analytics',
      description: 'Metrics, anomalies & ask AI',
      builder: (_) => const AnalyticsScreen(),
    ),
  ];

  Future<void> _logout(BuildContext context) async {
    await PushService.unregisterDevice();
    await AuthService.signOut();
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService.currentSession?.user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: () => _logout(context),
          ),
        ],
      ),
      body: ListView(
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
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(color: AppColors.mutedForeground),
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
          const SizedBox(height: 24),
          Text('Modules', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.15,
            children: [
              for (var i = 0; i < _modules.length; i++) _ModuleCard(module: _modules[i], accent: AppColors.triadAt(i)),
            ],
          ),
        ],
      ),
    );
  }
}

class _ModuleCard extends StatelessWidget {
  const _ModuleCard({required this.module, required this.accent});

  final _Module module;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: module.builder)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: accent.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
                child: Icon(module.icon, color: accent, size: 22),
              ),
              const Spacer(),
              Text(module.label, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(
                module.description,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.mutedForeground),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
