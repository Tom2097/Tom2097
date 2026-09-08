import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';

/// Real AI Analytics: the dashboard overview (GET /api/v1/analytics/overview,
/// backed by lib/analytics/dashboard.ts) plus a natural-language "ask AI"
/// box (POST /api/v1/analytics/ai-query, backed by lib/analytics/ai-query.ts,
/// which parses the question with an LLM and runs it against the real
/// analytics engine) -- both fully real, pre-existing APIs.
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic>? _metrics;
  List<Map<String, dynamic>> _anomalies = [];

  bool _isAsking = false;
  String? _askError;
  Map<String, dynamic>? _askResult;
  final _questionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _questionController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final result = await ApiClient.get('/api/v1/analytics/overview?timeRange=7d');
      final data = (result as Map)['data'] as Map<String, dynamic>;
      final anomalies = data['anomalies'] as Map<String, dynamic>?;
      setState(() {
        _metrics = data['metrics'] as Map<String, dynamic>?;
        _anomalies = (anomalies?['anomalies'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to load analytics');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _ask() async {
    final question = _questionController.text.trim();
    if (question.isEmpty) return;
    setState(() {
      _isAsking = true;
      _askError = null;
      _askResult = null;
    });
    try {
      final result = await ApiClient.post('/api/v1/analytics/ai-query', body: {'question': question});
      if (result is Map && result['success'] == true) {
        setState(() => _askResult = result['data'] as Map<String, dynamic>);
      } else {
        setState(() => _askError = (result is Map ? result['error'] as String? : null) ?? 'Failed to run query');
      }
    } on ApiException catch (e) {
      setState(() => _askError = e.message);
    } catch (e) {
      setState(() => _askError = 'Failed to run query');
    } finally {
      if (mounted) setState(() => _isAsking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI Analytics')),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _isLoading && _metrics == null
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _metrics == null
                ? ListView(
                    children: [
                      const SizedBox(height: 80),
                      Center(child: Text(_error!, style: const TextStyle(color: AppColors.destructive))),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_metrics != null) _MetricsGrid(metrics: _metrics!),
                      if (_anomalies.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        Text('Anomalies (last 7 days)', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        ..._anomalies.map((a) => _AnomalyTile(anomaly: a)),
                      ],
                      const SizedBox(height: 28),
                      Text('Ask AI', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Text(
                        'Ask a question about your business data in plain English.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.mutedForeground),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _questionController,
                              decoration: const InputDecoration(hintText: 'e.g. how many signups this week?'),
                              onSubmitted: (_) => _ask(),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filled(
                            onPressed: _isAsking ? null : _ask,
                            icon: _isAsking
                                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.auto_awesome),
                          ),
                        ],
                      ),
                      if (_askError != null) ...[
                        const SizedBox(height: 12),
                        Text(_askError!, style: const TextStyle(color: AppColors.destructive)),
                      ],
                      if (_askResult != null) ...[
                        const SizedBox(height: 16),
                        _AskResultCard(result: _askResult!),
                      ],
                    ],
                  ),
      ),
    );
  }
}

class _MetricsGrid extends StatelessWidget {
  const _MetricsGrid({required this.metrics});

  final Map<String, dynamic> metrics;

  @override
  Widget build(BuildContext context) {
    final totalEvents = metrics['totalEvents'] as num? ?? 0;
    final uniqueUsers = metrics['uniqueUsers'] as num? ?? 0;
    final growthRate = metrics['growthRate'] as num? ?? 0;
    final retentionRate = metrics['retentionRate'] as num? ?? 0;

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: [
        _MetricCard(label: 'Total events (7d)', value: '$totalEvents'),
        _MetricCard(label: 'Unique users', value: '$uniqueUsers'),
        _MetricCard(label: 'Growth rate', value: '${growthRate.toStringAsFixed(1)}%', color: growthRate >= 0 ? AppColors.green : AppColors.destructive),
        _MetricCard(label: 'Retention', value: '${retentionRate.toStringAsFixed(1)}%'),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, required this.value, this.color});

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(value, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700, color: color)),
            const SizedBox(height: 4),
            Text(label, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.mutedForeground)),
          ],
        ),
      ),
    );
  }
}

/// Matches DetectedAnomaly in lib/analytics/anomaly-detection.ts:37-59.
class _AnomalyTile extends StatelessWidget {
  const _AnomalyTile({required this.anomaly});

  final Map<String, dynamic> anomaly;

  @override
  Widget build(BuildContext context) {
    final metric = anomaly['metric'] as String? ?? 'Anomaly';
    final bucket = anomaly['bucket'] as String?;
    final value = anomaly['value'] as num?;
    final expected = anomaly['expectedValue'] as num?;
    final deviationPct = anomaly['deviationPercentage'] as num?;

    final parts = <String>[];
    if (bucket != null) parts.add(bucket);
    if (value != null && expected != null) parts.add('${value.toStringAsFixed(1)} vs expected ${expected.toStringAsFixed(1)}');
    if (deviationPct != null) parts.add('${deviationPct > 0 ? '+' : ''}${deviationPct.toStringAsFixed(0)}%');

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: ListTile(
          leading: const Icon(Icons.warning_amber_rounded, color: Color(0xFFF5A623)),
          title: Text(metric),
          subtitle: parts.isEmpty ? null : Text(parts.join(' · ')),
        ),
      ),
    );
  }
}

class _AskResultCard extends StatelessWidget {
  const _AskResultCard({required this.result});

  final Map<String, dynamic> result;

  @override
  Widget build(BuildContext context) {
    final explanation = result['explanation'] as String?;
    final queryResult = result['result'] as Map<String, dynamic>?;
    final summary = queryResult?['summary'] as Map<String, dynamic>?;
    final rows = (queryResult?['rows'] as List?)?.cast<Map<String, dynamic>>();
    final points = (queryResult?['points'] as List?)?.cast<Map<String, dynamic>>();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (explanation != null) Text(explanation, style: const TextStyle(color: AppColors.mutedForeground, fontSize: 13)),
            if (summary != null) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 16,
                runSpacing: 8,
                children: summary.entries.map((e) => _SummaryStat(label: e.key, value: e.value)).toList(),
              ),
            ],
            if (rows != null && rows.isNotEmpty) ...[
              const SizedBox(height: 12),
              ...rows.take(10).map((r) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: Text(r['label']?.toString() ?? '')),
                        Text('${r['value']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      ],
                    ),
                  )),
            ],
            if (points != null && points.isNotEmpty) ...[
              const SizedBox(height: 12),
              ...points.take(10).map((p) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: Text(p['bucket']?.toString() ?? '')),
                        Text('${p['value']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      ],
                    ),
                  )),
            ],
          ],
        ),
      ),
    );
  }
}

class _SummaryStat extends StatelessWidget {
  const _SummaryStat({required this.label, required this.value});

  final String label;
  final Object? value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('$value', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
        Text(label, style: const TextStyle(color: AppColors.mutedForeground, fontSize: 11)),
      ],
    );
  }
}
