import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'capa_detail_screen.dart';

const _amber = Color(0xFFF5A623);

/// Matches CapaSeverity in lib/compliance/capa.ts:8.
Color capaSeverityColor(String severity) => switch (severity) {
      'critical' => AppColors.destructive,
      'major' => _amber,
      _ => AppColors.blue,
    };

/// Matches CapaStatus in lib/compliance/capa.ts:7.
String capaStatusLabel(String status) => switch (status) {
      'open' => 'Open',
      'investigation' => 'Investigation',
      'action' => 'Action',
      'verification' => 'Verification',
      'closed' => 'Closed',
      _ => status,
    };

Color scoreColor(num score) {
  if (score >= 80) return AppColors.green;
  if (score >= 50) return _amber;
  return AppColors.destructive;
}

/// Real Compliance: framework scores (GET /api/v1/compliance/scores, backed
/// by lib/compliance/scoring.ts) plus CAPA records (GET
/// /api/v1/compliance/capas, backed by lib/compliance/capa.ts) -- both
/// fully real, pre-existing APIs.
class ComplianceScreen extends StatefulWidget {
  const ComplianceScreen({super.key});

  @override
  State<ComplianceScreen> createState() => _ComplianceScreenState();
}

class _ComplianceScreenState extends State<ComplianceScreen> {
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic>? _scores;
  List<Map<String, dynamic>> _capas = [];

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
        ApiClient.get('/api/v1/compliance/scores'),
        ApiClient.get('/api/v1/compliance/capas'),
      ]);
      setState(() {
        _scores = results[0] as Map<String, dynamic>;
        _capas = (results[1] as List).cast<Map<String, dynamic>>();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to load compliance data');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Compliance')),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _isLoading && _scores == null
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _scores == null
                ? ListView(
                    children: [
                      const SizedBox(height: 80),
                      Center(child: Text(_error!, style: const TextStyle(color: AppColors.destructive))),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_scores != null) _OverallScoreCard(scores: _scores!),
                      const SizedBox(height: 24),
                      Text('CAPA records', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      if (_capas.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Center(child: Text('No CAPA records', style: TextStyle(color: AppColors.mutedForeground))),
                        )
                      else
                        ..._capas.map((c) => _CapaTile(
                              capa: c,
                              onTap: () async {
                                await Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => CapaDetailScreen(capa: c)),
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

class _OverallScoreCard extends StatelessWidget {
  const _OverallScoreCard({required this.scores});

  final Map<String, dynamic> scores;

  @override
  Widget build(BuildContext context) {
    final overall = (scores['overall'] as num?) ?? 0;
    final byFramework = (scores['by_framework'] as List?)?.cast<Map<String, dynamic>>() ?? const [];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  '$overall%',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700, color: scoreColor(overall)),
                ),
                const SizedBox(width: 10),
                const Text('Overall compliance', style: TextStyle(color: AppColors.mutedForeground)),
              ],
            ),
            if (byFramework.isNotEmpty) ...[
              const SizedBox(height: 16),
              ...byFramework.map((fw) {
                final score = (fw['score'] as num?) ?? 0;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Text(fw['framework'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w600))),
                          Text('$score%', style: TextStyle(color: scoreColor(score), fontWeight: FontWeight.w700)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: (score.clamp(0, 100)) / 100,
                          minHeight: 6,
                          backgroundColor: AppColors.border,
                          valueColor: AlwaysStoppedAnimation(scoreColor(score)),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }
}

class _CapaTile extends StatelessWidget {
  const _CapaTile({required this.capa, required this.onTap});

  final Map<String, dynamic> capa;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final severity = capa['severity'] as String? ?? 'minor';
    final status = capa['status'] as String? ?? 'open';

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
                  decoration: BoxDecoration(color: capaSeverityColor(severity), borderRadius: BorderRadius.circular(2)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(capa['title'] as String? ?? 'Untitled CAPA', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 4),
                      _Badge(text: capaStatusLabel(status), color: capaSeverityColor(severity)),
                    ],
                  ),
                ),
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
