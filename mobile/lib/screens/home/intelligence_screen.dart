import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'finding_detail_screen.dart';

const _amber = Color(0xFFF5A623);

/// Matches intelligence_findings' status CHECK in
/// supabase/migrations/20260628_intelligence_brain.sql:40.
Color findingStatusColor(String status) => switch (status) {
      'active' => _amber,
      'resolved' => AppColors.green,
      'dismissed' => AppColors.mutedForeground,
      _ => AppColors.mutedForeground,
    };

String findingStatusLabel(String status) => switch (status) {
      'active' => 'Active',
      'resolved' => 'Resolved',
      'dismissed' => 'Dismissed',
      _ => status,
    };

/// Real AI Intelligence: the daily briefing (GET /api/v1/intelligence/briefing)
/// plus AI-detected findings (GET /api/v1/intelligence/findings) -- the same
/// two endpoints components/digit/intelligence-command-center.tsx reads on
/// the website. Agent orchestration/run/status/scheduler are still stubbed
/// server-side and out of scope here.
class IntelligenceScreen extends StatefulWidget {
  const IntelligenceScreen({super.key});

  @override
  State<IntelligenceScreen> createState() => _IntelligenceScreenState();
}

class _IntelligenceScreenState extends State<IntelligenceScreen> {
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic>? _briefing;
  List<Map<String, dynamic>> _findings = [];

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
      final results = await Future.wait([
        ApiClient.get('/api/v1/intelligence/briefing'),
        ApiClient.get('/api/v1/intelligence/findings?limit=20'),
      ]);
      setState(() {
        _briefing = results[0] as Map<String, dynamic>;
        _findings = ((results[1] as Map)['findings'] as List).cast<Map<String, dynamic>>();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to load intelligence data');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI Intelligence')),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _isLoading && _briefing == null
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _briefing == null
                ? ListView(
                    children: [
                      const SizedBox(height: 80),
                      Center(child: Text(_error!, style: const TextStyle(color: AppColors.destructive))),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_briefing != null) _BriefingCard(briefing: _briefing!),
                      const SizedBox(height: 24),
                      Text('Findings', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      if (_findings.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Center(child: Text('No findings yet', style: TextStyle(color: AppColors.mutedForeground))),
                        )
                      else
                        ..._findings.map((f) => _FindingTile(
                              finding: f,
                              onTap: () async {
                                await Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => FindingDetailScreen(finding: f)),
                                );
                                _load();
                              },
                            )),
                    ],
                  ),
      ),
    );
  }
}

class _BriefingCard extends StatelessWidget {
  const _BriefingCard({required this.briefing});

  final Map<String, dynamic> briefing;

  @override
  Widget build(BuildContext context) {
    final summary = briefing['summary'] as String? ?? 'No briefing available yet.';
    final metrics = (briefing['metrics'] as List?)?.cast<Map<String, dynamic>>() ?? const [];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.auto_awesome, color: AppColors.primary, size: 18),
                const SizedBox(width: 8),
                Text('Daily briefing', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 10),
            Text(summary, style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.4)),
            if (metrics.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 16,
                runSpacing: 8,
                children: metrics.take(6).map((m) {
                  final label = m['label'] as String? ?? m['name'] as String? ?? '';
                  final value = m['value'];
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('$value', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                      Text(label, style: const TextStyle(color: AppColors.mutedForeground, fontSize: 11)),
                    ],
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _FindingTile extends StatelessWidget {
  const _FindingTile({required this.finding, required this.onTap});

  final Map<String, dynamic> finding;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = finding['status'] as String? ?? 'active';
    final impactScore = finding['impactScore'] as num?;
    final monetaryRisk = finding['monetaryRisk'] as num?;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 4,
                  height: 40,
                  decoration: BoxDecoration(color: findingStatusColor(status), borderRadius: BorderRadius.circular(2)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(finding['title'] as String? ?? 'Untitled finding', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          _Badge(text: findingStatusLabel(status), color: findingStatusColor(status)),
                          if (impactScore != null) ...[
                            const SizedBox(width: 6),
                            Text('Impact ${impactScore.toStringAsFixed(0)}', style: const TextStyle(color: AppColors.mutedForeground, fontSize: 11)),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                if (monetaryRisk != null && monetaryRisk > 0)
                  Text('\$${monetaryRisk.toStringAsFixed(0)}', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: AppColors.destructive)),
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
