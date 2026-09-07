import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'operations_screen.dart';

const _incidentStatuses = ['open', 'investigating', 'identified', 'monitoring', 'resolved'];

/// Single-incident view + a real status-change action (PATCH
/// /api/v1/monitoring/incidents/[id]) -- lets an on-call admin triage an
/// incident from their phone instead of needing the web dashboard.
class IncidentDetailScreen extends StatefulWidget {
  const IncidentDetailScreen({super.key, required this.incident});

  final Map<String, dynamic> incident;

  @override
  State<IncidentDetailScreen> createState() => _IncidentDetailScreenState();
}

class _IncidentDetailScreenState extends State<IncidentDetailScreen> {
  late Map<String, dynamic> _incident;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _incident = Map<String, dynamic>.from(widget.incident);
  }

  Future<void> _changeStatus() async {
    final currentStatus = _incident['status'] as String? ?? 'open';
    final newStatus = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Update status', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            for (final status in _incidentStatuses)
              ListTile(
                title: Text(incidentStatusLabel(status)),
                trailing: status == currentStatus ? const Icon(Icons.check, color: AppColors.primary) : null,
                onTap: () => Navigator.of(context).pop(status),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (newStatus == null || newStatus == currentStatus) return;

    setState(() {
      _isSaving = true;
      _error = null;
    });
    try {
      final result = await ApiClient.patch(
        '/api/v1/monitoring/incidents/${_incident['id']}',
        body: {'status': newStatus},
      );
      final updated = (result is Map && result['incident'] is Map)
          ? Map<String, dynamic>.from(result['incident'] as Map)
          : {..._incident, 'status': newStatus};
      setState(() => _incident = updated);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Marked ${incidentStatusLabel(newStatus)}')),
        );
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to update incident');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final severity = _incident['severity'] as String? ?? 'low';
    final status = _incident['status'] as String? ?? 'open';
    final summary = _incident['summary'] as String?;
    final startedAt = _incident['started_at'] as String?;
    final resolvedAt = _incident['resolved_at'] as String?;

    return Scaffold(
      appBar: AppBar(title: const Text('Incident')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            _incident['title'] as String? ?? 'Untitled incident',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _Badge(text: severity.toUpperCase(), color: incidentSeverityColor(severity)),
              const SizedBox(width: 10),
              _Badge(text: incidentStatusLabel(status), color: AppColors.blue),
            ],
          ),
          if (summary != null && summary.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text('Summary', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: AppColors.mutedForeground)),
            const SizedBox(height: 6),
            Text(summary),
          ],
          if (startedAt != null) ...[
            const SizedBox(height: 20),
            Text('Started ${relativeTime(DateTime.parse(startedAt))}', style: const TextStyle(color: AppColors.mutedForeground)),
          ],
          if (resolvedAt != null) ...[
            const SizedBox(height: 4),
            Text('Resolved ${relativeTime(DateTime.parse(resolvedAt))}', style: const TextStyle(color: AppColors.mutedForeground)),
          ],
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: AppColors.destructive)),
          ],
          const SizedBox(height: 28),
          FilledButton.icon(
            onPressed: _isSaving ? null : _changeStatus,
            icon: _isSaving
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.swap_horiz),
            label: Text(_isSaving ? 'Updating…' : 'Update status'),
          ),
        ],
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
      child: Text(text, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
    );
  }
}
