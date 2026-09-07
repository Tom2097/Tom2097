import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'incident_detail_screen.dart';

/// Matches MonitorStatus in lib/monitoring/types.ts:22-23 exactly.
const _amber = Color(0xFFF5A623);

Color monitorStatusColor(String status) => switch (status) {
      'up' => AppColors.green,
      'down' => AppColors.destructive,
      'degraded' => _amber,
      _ => AppColors.mutedForeground,
    };

String monitorStatusLabel(String status) => switch (status) {
      'up' => 'Up',
      'down' => 'Down',
      'degraded' => 'Degraded',
      _ => 'Unknown',
    };

/// Matches IncidentSeverity in lib/monitoring/types.ts:25-26.
Color incidentSeverityColor(String severity) => switch (severity) {
      'critical' => AppColors.destructive,
      'high' => _amber,
      'medium' => AppColors.blue,
      _ => AppColors.mutedForeground,
    };

/// Matches IncidentStatus in lib/monitoring/types.ts:28-29.
String incidentStatusLabel(String status) => switch (status) {
      'open' => 'Open',
      'investigating' => 'Investigating',
      'identified' => 'Identified',
      'monitoring' => 'Monitoring',
      'resolved' => 'Resolved',
      _ => status,
    };

String relativeTime(DateTime dt) {
  final diff = DateTime.now().difference(dt);
  if (diff.inMinutes < 1) return 'now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return '${dt.month}/${dt.day}';
}

/// Real Operations: aggregate health (GET /api/v1/monitoring/health) plus
/// the underlying monitors and incidents lists -- the mobile view of the
/// same monitors/incidents tables the web dashboard reads via
/// lib/monitoring/engine.ts. Read-only for monitors (configuring a check is
/// an admin/web task); incidents can be triaged from here by tapping in.
class OperationsScreen extends StatefulWidget {
  const OperationsScreen({super.key});

  @override
  State<OperationsScreen> createState() => _OperationsScreenState();
}

class _OperationsScreenState extends State<OperationsScreen> {
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic>? _health;
  List<Map<String, dynamic>> _monitors = [];
  List<Map<String, dynamic>> _incidents = [];

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
        ApiClient.get('/api/v1/monitoring/health'),
        ApiClient.get('/api/v1/monitoring/monitors?limit=100'),
        ApiClient.get('/api/v1/monitoring/incidents?limit=20'),
      ]);
      setState(() {
        _health = results[0] as Map<String, dynamic>;
        _monitors = ((results[1] as Map)['monitors'] as List).cast<Map<String, dynamic>>();
        _incidents = ((results[2] as Map)['incidents'] as List).cast<Map<String, dynamic>>();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to load operations data');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Operations')),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _isLoading && _health == null
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _health == null
                ? ListView(
                    children: [
                      const SizedBox(height: 80),
                      Center(child: Text(_error!, style: const TextStyle(color: AppColors.destructive))),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_health != null) _HealthSummaryCard(health: _health!),
                      const SizedBox(height: 24),
                      Text('Monitors', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      if (_monitors.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Center(child: Text('No monitors configured', style: TextStyle(color: AppColors.mutedForeground))),
                        )
                      else
                        ..._monitors.map((m) => _MonitorTile(monitor: m)),
                      const SizedBox(height: 24),
                      Text('Recent incidents', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      if (_incidents.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Center(child: Text('No incidents', style: TextStyle(color: AppColors.mutedForeground))),
                        )
                      else
                        ..._incidents.map((i) => _IncidentTile(
                              incident: i,
                              onTap: () async {
                                await Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => IncidentDetailScreen(incident: i)),
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

class _HealthSummaryCard extends StatelessWidget {
  const _HealthSummaryCard({required this.health});

  final Map<String, dynamic> health;

  @override
  Widget build(BuildContext context) {
    final overall = health['overall'] as String? ?? 'unknown';
    final monitors = (health['monitors'] as Map?) ?? const {};
    final openIncidents = health['open_incidents'] as int? ?? 0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(color: monitorStatusColor(overall), shape: BoxShape.circle),
                ),
                const SizedBox(width: 8),
                Text(
                  'System ${monitorStatusLabel(overall)}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                if (openIncidents > 0) _Badge(text: '$openIncidents open', color: AppColors.destructive),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: _StatColumn(label: 'Up', value: '${monitors['up'] ?? 0}', color: AppColors.green)),
                Expanded(child: _StatColumn(label: 'Degraded', value: '${monitors['degraded'] ?? 0}', color: _amber)),
                Expanded(child: _StatColumn(label: 'Down', value: '${monitors['down'] ?? 0}', color: AppColors.destructive)),
                Expanded(child: _StatColumn(label: 'Total', value: '${monitors['total'] ?? 0}', color: AppColors.mutedForeground)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatColumn extends StatelessWidget {
  const _StatColumn({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: color)),
        const SizedBox(height: 2),
        Text(label, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.mutedForeground)),
      ],
    );
  }
}

class _MonitorTile extends StatelessWidget {
  const _MonitorTile({required this.monitor});

  final Map<String, dynamic> monitor;

  @override
  Widget build(BuildContext context) {
    final status = monitor['last_status'] as String? ?? 'unknown';
    final name = monitor['name'] as String? ?? 'Unnamed monitor';
    final target = monitor['target'] as String? ?? '';
    final latency = monitor['last_latency_ms'] as int?;
    final lastChecked = monitor['last_checked_at'] as String?;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(color: monitorStatusColor(status), shape: BoxShape.circle),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                    if (target.isNotEmpty)
                      Text(target, style: const TextStyle(color: AppColors.mutedForeground, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (latency != null)
                    Text('${latency}ms', style: Theme.of(context).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w600)),
                  if (lastChecked != null)
                    Text(relativeTime(DateTime.parse(lastChecked)), style: const TextStyle(color: AppColors.mutedForeground, fontSize: 11)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IncidentTile extends StatelessWidget {
  const _IncidentTile({required this.incident, required this.onTap});

  final Map<String, dynamic> incident;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final severity = incident['severity'] as String? ?? 'low';
    final status = incident['status'] as String? ?? 'open';
    final title = incident['title'] as String? ?? 'Untitled incident';
    final startedAt = incident['started_at'] as String?;

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
                  decoration: BoxDecoration(color: incidentSeverityColor(severity), borderRadius: BorderRadius.circular(2)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          _Badge(text: incidentStatusLabel(status), color: incidentSeverityColor(severity)),
                          if (startedAt != null) ...[
                            const SizedBox(width: 8),
                            Text(relativeTime(DateTime.parse(startedAt)), style: const TextStyle(color: AppColors.mutedForeground, fontSize: 11)),
                          ],
                        ],
                      ),
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
