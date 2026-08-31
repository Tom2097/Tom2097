import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'crm_screen.dart';

/// Single-deal view + a real stage-change action (PATCH
/// /api/v1/crm/deals/[id]) -- the mobile equivalent of dragging a card
/// between columns on the website's kanban board
/// (components/digit/crm-pipeline-board.tsx).
class DealDetailScreen extends StatefulWidget {
  const DealDetailScreen({super.key, required this.deal});

  final Map<String, dynamic> deal;

  @override
  State<DealDetailScreen> createState() => _DealDetailScreenState();
}

class _DealDetailScreenState extends State<DealDetailScreen> {
  late Map<String, dynamic> _deal;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _deal = Map<String, dynamic>.from(widget.deal);
  }

  Future<void> _changeStage() async {
    final currentStage = _deal['stage'] as String? ?? 'lead';
    final newStage = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Move to stage', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            for (final stage in kDealStages)
              ListTile(
                leading: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(color: stageColor(stage), shape: BoxShape.circle),
                ),
                title: Text(stageLabel(stage)),
                trailing: stage == currentStage ? const Icon(Icons.check, color: AppColors.primary) : null,
                onTap: () => Navigator.of(context).pop(stage),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (newStage == null || newStage == currentStage) return;

    setState(() {
      _isSaving = true;
      _error = null;
    });
    try {
      final result = await ApiClient.patch(
        '/api/v1/crm/deals/${_deal['id']}',
        body: {'stage': newStage},
      );
      final updated = (result is Map && result['deal'] is Map)
          ? Map<String, dynamic>.from(result['deal'] as Map)
          : {..._deal, 'stage': newStage};
      setState(() => _deal = updated);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Moved to ${stageLabel(newStage)}')),
        );
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to update deal');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stage = _deal['stage'] as String? ?? 'lead';
    final value = (_deal['value'] as num?) ?? 0;
    final currency = _deal['currency'] as String? ?? 'USD';
    final probability = _deal['probability'] as int? ?? 0;
    final description = _deal['description'] as String?;
    final tags = (_deal['tags'] as List?)?.cast<String>() ?? const [];
    final expectedClose = _deal['expected_close_date'] as String?;
    final createdAt = _deal['created_at'] as String?;

    return Scaffold(
      appBar: AppBar(title: const Text('Deal')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            _deal['title'] as String? ?? 'Untitled deal',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _Badge(text: stageLabel(stage), color: stageColor(stage)),
              const SizedBox(width: 10),
              Text('$probability% probability', style: const TextStyle(color: AppColors.mutedForeground)),
            ],
          ),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    formatCurrency(value, currency),
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                  ),
                  if (expectedClose != null) ...[
                    const SizedBox(height: 4),
                    Text('Expected close: $expectedClose', style: const TextStyle(color: AppColors.mutedForeground)),
                  ],
                ],
              ),
            ),
          ),
          if (description != null && description.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text('Description', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: AppColors.mutedForeground)),
            const SizedBox(height: 6),
            Text(description),
          ],
          if (tags.isNotEmpty) ...[
            const SizedBox(height: 20),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: tags.map((t) => Chip(label: Text(t))).toList(),
            ),
          ],
          if (createdAt != null) ...[
            const SizedBox(height: 20),
            Text(
              'Created $createdAt',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.mutedForeground),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: AppColors.destructive)),
          ],
          const SizedBox(height: 28),
          FilledButton.icon(
            onPressed: _isSaving ? null : _changeStage,
            icon: _isSaving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.swap_horiz),
            label: Text(_isSaving ? 'Moving…' : 'Move to another stage'),
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
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
    );
  }
}
