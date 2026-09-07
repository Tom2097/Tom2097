import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'objective_detail_screen.dart';

const _amber = Color(0xFFF5A623);

/// Matches Objective['status'] in lib/analytics/okr.ts:4-14.
Color objectiveStatusColor(String status) => switch (status) {
      'on_track' => AppColors.green,
      'at_risk' => _amber,
      'behind' => AppColors.destructive,
      'completed' => AppColors.blue,
      _ => AppColors.mutedForeground,
    };

String objectiveStatusLabel(String status) => switch (status) {
      'on_track' => 'On track',
      'at_risk' => 'At risk',
      'behind' => 'Behind',
      'completed' => 'Completed',
      _ => status,
    };

/// Real Performance: OKRs (GET /api/v1/okr/objectives), the same objectives
/// table app/(dashboard)/performance/page.tsx reads via lib/analytics/okr.ts.
/// Cohort benchmarking/forecasting on that page are read-only analytics
/// widgets with no API route of their own (server-component-only) -- out of
/// scope here; objectives + key results are the actionable part.
class PerformanceScreen extends StatefulWidget {
  const PerformanceScreen({super.key});

  @override
  State<PerformanceScreen> createState() => _PerformanceScreenState();
}

class _PerformanceScreenState extends State<PerformanceScreen> {
  bool _isLoading = true;
  String? _error;
  List<Map<String, dynamic>> _objectives = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final result = await ApiClient.get('/api/v1/okr/objectives');
      setState(() {
        _objectives = ((result as Map)['objectives'] as List).cast<Map<String, dynamic>>();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to load objectives');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = _objectives.where((o) => o['status'] != 'completed').length;

    return Scaffold(
      appBar: AppBar(title: const Text('Performance')),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _isLoading && _objectives.isEmpty && _error == null
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _objectives.isEmpty
                ? ListView(
                    children: [
                      const SizedBox(height: 80),
                      Center(child: Text(_error!, style: const TextStyle(color: AppColors.destructive))),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Expanded(
                                child: _StatColumn(label: 'Active objectives', value: '$active'),
                              ),
                              Container(width: 1, height: 36, color: AppColors.border),
                              Expanded(
                                child: _StatColumn(label: 'Total', value: '${_objectives.length}'),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      if (_objectives.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 60),
                          child: Center(child: Text('No objectives yet', style: TextStyle(color: AppColors.mutedForeground))),
                        )
                      else
                        ..._objectives.map((o) => _ObjectiveTile(
                              objective: o,
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => ObjectiveDetailScreen(objective: o)),
                              ),
                            )),
                    ],
                  ),
      ),
    );
  }
}

class _StatColumn extends StatelessWidget {
  const _StatColumn({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(label, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.mutedForeground), textAlign: TextAlign.center),
      ],
    );
  }
}

class _ObjectiveTile extends StatelessWidget {
  const _ObjectiveTile({required this.objective, required this.onTap});

  final Map<String, dynamic> objective;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = objective['status'] as String? ?? 'on_track';
    final progress = ((objective['progress'] as num?) ?? 0).clamp(0, 100) / 100;
    final name = objective['name'] as String? ?? 'Untitled objective';
    final category = objective['category'] as String?;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(name, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                    _Badge(text: objectiveStatusLabel(status), color: objectiveStatusColor(status)),
                  ],
                ),
                if (category != null && category.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(category, style: const TextStyle(color: AppColors.mutedForeground, fontSize: 12)),
                ],
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress.toDouble(),
                    minHeight: 6,
                    backgroundColor: AppColors.border,
                    valueColor: AlwaysStoppedAnimation(objectiveStatusColor(status)),
                  ),
                ),
                const SizedBox(height: 4),
                Text('${(progress * 100).round()}%', style: const TextStyle(color: AppColors.mutedForeground, fontSize: 11)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }
}
