import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'performance_screen.dart';

/// Single-objective view: its key results (GET .../key-results) with a real
/// "update current value" action (PATCH .../key-results), which recomputes
/// the parent objective's weighted progress server-side.
class ObjectiveDetailScreen extends StatefulWidget {
  const ObjectiveDetailScreen({super.key, required this.objective});

  final Map<String, dynamic> objective;

  @override
  State<ObjectiveDetailScreen> createState() => _ObjectiveDetailScreenState();
}

class _ObjectiveDetailScreenState extends State<ObjectiveDetailScreen> {
  bool _isLoading = true;
  String? _error;
  List<Map<String, dynamic>> _keyResults = [];

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
      final result = await ApiClient.get('/api/v1/okr/objectives/${widget.objective['id']}/key-results');
      setState(() {
        _keyResults = ((result as Map)['keyResults'] as List).cast<Map<String, dynamic>>();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to load key results');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _updateValue(Map<String, dynamic> kr) async {
    final controller = TextEditingController(text: '${kr['current'] ?? 0}');
    final newValue = await showDialog<double>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Update ${kr['name']}'),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(labelText: 'Current value', suffixText: kr['unit'] as String?),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(double.tryParse(controller.text)),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    if (newValue == null) return;

    try {
      final result = await ApiClient.patch(
        '/api/v1/okr/objectives/${widget.objective['id']}/key-results',
        body: {'keyResultId': kr['id'], 'currentValue': newValue},
      );
      final updated = (result is Map && result['keyResult'] is Map)
          ? Map<String, dynamic>.from(result['keyResult'] as Map)
          : {...kr, 'current': newValue};
      setState(() {
        _keyResults = _keyResults.map((k) => k['id'] == kr['id'] ? updated : k).toList();
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Updated')));
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to update')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.objective['status'] as String? ?? 'on_track';
    final progress = ((widget.objective['progress'] as num?) ?? 0).clamp(0, 100) / 100;

    return Scaffold(
      appBar: AppBar(title: const Text('Objective')),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              widget.objective['name'] as String? ?? 'Untitled objective',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _Badge(text: objectiveStatusLabel(status), color: objectiveStatusColor(status)),
                const SizedBox(width: 10),
                Text('${(progress * 100).round()}% overall', style: const TextStyle(color: AppColors.mutedForeground)),
              ],
            ),
            const SizedBox(height: 24),
            Text('Key results', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            if (_isLoading)
              const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator()))
            else if (_error != null)
              Padding(padding: const EdgeInsets.symmetric(vertical: 24), child: Text(_error!, style: const TextStyle(color: AppColors.destructive)))
            else if (_keyResults.isEmpty)
              const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Text('No key results yet', style: TextStyle(color: AppColors.mutedForeground)))
            else
              ..._keyResults.map((kr) => _KeyResultCard(keyResult: kr, onTap: () => _updateValue(kr))),
          ],
        ),
      ),
    );
  }
}

class _KeyResultCard extends StatelessWidget {
  const _KeyResultCard({required this.keyResult, required this.onTap});

  final Map<String, dynamic> keyResult;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final target = (keyResult['target'] as num?) ?? 0;
    final current = (keyResult['current'] as num?) ?? 0;
    final unit = keyResult['unit'] as String? ?? '';
    final ratio = target == 0 ? 0.0 : (current / target).clamp(0, 1).toDouble();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
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
                      child: Text(
                        keyResult['name'] as String? ?? 'Key result',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                    const Icon(Icons.edit_outlined, size: 16, color: AppColors.mutedForeground),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: ratio,
                    minHeight: 6,
                    backgroundColor: AppColors.border,
                    valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                  ),
                ),
                const SizedBox(height: 6),
                Text('$current / $target $unit'.trim(), style: const TextStyle(color: AppColors.mutedForeground, fontSize: 12)),
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
      child: Text(text, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
    );
  }
}
