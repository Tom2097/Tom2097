import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'intelligence_screen.dart';

/// Single finding view + a real "Resolve" action (POST
/// /api/v1/intelligence/execute, the same route the web command center's
/// "Resolve Now" button calls).
class FindingDetailScreen extends StatefulWidget {
  const FindingDetailScreen({super.key, required this.finding});

  final Map<String, dynamic> finding;

  @override
  State<FindingDetailScreen> createState() => _FindingDetailScreenState();
}

class _FindingDetailScreenState extends State<FindingDetailScreen> {
  late Map<String, dynamic> _finding;
  bool _isResolving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _finding = Map<String, dynamic>.from(widget.finding);
  }

  Future<void> _resolve() async {
    setState(() {
      _isResolving = true;
      _error = null;
    });
    try {
      final result = await ApiClient.post('/api/v1/intelligence/execute', body: {'actionId': _finding['id']});
      if (result is Map && result['success'] == true) {
        setState(() => _finding = {..._finding, 'status': 'resolved'});
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Finding resolved')));
      } else {
        setState(() => _error = (result is Map ? result['error'] as String? : null) ?? 'Failed to resolve');
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to resolve finding');
    } finally {
      if (mounted) setState(() => _isResolving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = _finding['status'] as String? ?? 'active';
    final description = _finding['description'] as String?;
    final suggestedAction = _finding['suggestedAction'] as String?;
    final confidence = _finding['confidence'] as num?;
    final monetaryRisk = _finding['monetaryRisk'] as num?;
    final sourceModule = _finding['sourceModule'] as String?;
    final canResolve = status == 'active';

    return Scaffold(
      appBar: AppBar(title: const Text('Finding')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            _finding['title'] as String? ?? 'Untitled finding',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _Badge(text: findingStatusLabel(status), color: findingStatusColor(status)),
              if (sourceModule != null) ...[
                const SizedBox(width: 10),
                Text(sourceModule, style: const TextStyle(color: AppColors.mutedForeground)),
              ],
            ],
          ),
          if (description != null && description.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text('Description', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: AppColors.mutedForeground)),
            const SizedBox(height: 6),
            Text(description),
          ],
          if (suggestedAction != null && suggestedAction.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Suggested action', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: AppColors.mutedForeground)),
            const SizedBox(height: 6),
            Text(suggestedAction),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              if (confidence != null) ...[
                Text('Confidence: ${confidence.toStringAsFixed(0)}%', style: const TextStyle(color: AppColors.mutedForeground)),
                const SizedBox(width: 16),
              ],
              if (monetaryRisk != null && monetaryRisk > 0)
                Text('Risk: \$${monetaryRisk.toStringAsFixed(0)}', style: const TextStyle(color: AppColors.destructive, fontWeight: FontWeight.w600)),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: AppColors.destructive)),
          ],
          if (canResolve) ...[
            const SizedBox(height: 28),
            FilledButton.icon(
              onPressed: _isResolving ? null : _resolve,
              icon: _isResolving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.check_circle_outline),
              label: Text(_isResolving ? 'Resolving…' : 'Resolve'),
            ),
          ],
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
