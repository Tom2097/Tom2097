import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'deal_detail_screen.dart';

/// Deal stages, in pipeline order. Matches DealStage in
/// lib/crm/types.ts:13-14 exactly -- these are the literal values the
/// backend stores and expects on PATCH, not display labels.
const kDealStages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

String stageLabel(String stage) => switch (stage) {
      'lead' => 'Lead',
      'qualified' => 'Qualified',
      'proposal' => 'Proposal',
      'negotiation' => 'Negotiation',
      'won' => 'Won',
      'lost' => 'Lost',
      _ => stage,
    };

Color stageColor(String stage) => switch (stage) {
      'lead' => AppColors.mutedForeground,
      'qualified' => AppColors.blue,
      'proposal' => AppColors.primary,
      'negotiation' => const Color(0xFFF5A623),
      'won' => AppColors.green,
      'lost' => AppColors.destructive,
      _ => AppColors.mutedForeground,
    };

String formatCurrency(num value, String currency) {
  final symbol = currency.toUpperCase() == 'USD' ? r'$' : '$currency ';
  final rounded = value.round();
  final str = rounded.toString().replaceAllMapped(
        RegExp(r'\B(?=(\d{3})+(?!\d))'),
        (m) => ',',
      );
  return '$symbol$str';
}

/// Real CRM: pipeline summary (GET /api/v1/crm/pipeline) + a filterable
/// deals list (GET /api/v1/crm/deals) -- the same two endpoints
/// components/digit/crm-pipeline-board.tsx uses on the website. A kanban
/// board doesn't translate well to a phone screen, so this uses a stage
/// filter + list instead of columns, while staying backed by identical data.
class CrmScreen extends StatefulWidget {
  const CrmScreen({super.key});

  @override
  State<CrmScreen> createState() => _CrmScreenState();
}

class _CrmScreenState extends State<CrmScreen> {
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic>? _pipeline;
  List<Map<String, dynamic>> _deals = [];
  String? _stageFilter;

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
      final dealsPath = _stageFilter == null
          ? '/api/v1/crm/deals?limit=100'
          : '/api/v1/crm/deals?stage=$_stageFilter&limit=100';
      final results = await Future.wait([
        ApiClient.get('/api/v1/crm/pipeline'),
        ApiClient.get(dealsPath),
      ]);
      setState(() {
        _pipeline = results[0] as Map<String, dynamic>;
        _deals = ((results[1] as Map)['deals'] as List).cast<Map<String, dynamic>>();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to load CRM data');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _selectStage(String? stage) async {
    setState(() => _stageFilter = stage);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CRM')),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _isLoading && _pipeline == null
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _pipeline == null
                ? ListView(
                    children: [
                      const SizedBox(height: 80),
                      Center(
                        child: Text(_error!, style: const TextStyle(color: AppColors.destructive)),
                      ),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_pipeline != null) _PipelineSummaryCard(pipeline: _pipeline!),
                      const SizedBox(height: 20),
                      _StageFilterRow(selected: _stageFilter, onSelect: _selectStage),
                      const SizedBox(height: 12),
                      if (_deals.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 60),
                          child: Center(
                            child: Text('No deals here', style: TextStyle(color: AppColors.mutedForeground)),
                          ),
                        )
                      else
                        ..._deals.map((deal) => _DealTile(
                              deal: deal,
                              onTap: () async {
                                await Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => DealDetailScreen(deal: deal)),
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

class _PipelineSummaryCard extends StatelessWidget {
  const _PipelineSummaryCard({required this.pipeline});

  final Map<String, dynamic> pipeline;

  @override
  Widget build(BuildContext context) {
    final currency = pipeline['currency'] as String? ?? 'USD';
    final openValue = (pipeline['total_open_value'] as num?) ?? 0;
    final weightedValue = (pipeline['weighted_open_value'] as num?) ?? 0;
    final openDeals = pipeline['open_deals'] as int? ?? 0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: _StatColumn(
                label: 'Open pipeline',
                value: formatCurrency(openValue, currency),
              ),
            ),
            Container(width: 1, height: 36, color: AppColors.border),
            Expanded(
              child: _StatColumn(
                label: 'Weighted',
                value: formatCurrency(weightedValue, currency),
              ),
            ),
            Container(width: 1, height: 36, color: AppColors.border),
            Expanded(
              child: _StatColumn(label: 'Open deals', value: '$openDeals'),
            ),
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
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.mutedForeground),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _StageFilterRow extends StatelessWidget {
  const _StageFilterRow({required this.selected, required this.onSelect});

  final String? selected;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _chip(context, null, 'All'),
          const SizedBox(width: 8),
          for (final stage in kDealStages) ...[
            _chip(context, stage, stageLabel(stage)),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }

  Widget _chip(BuildContext context, String? stage, String label) {
    final isSelected = selected == stage;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => onSelect(stage),
      selectedColor: (stage == null ? AppColors.primary : stageColor(stage)).withValues(alpha: 0.2),
      labelStyle: TextStyle(
        color: isSelected ? AppColors.foreground : AppColors.mutedForeground,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
      ),
      side: BorderSide(color: isSelected ? (stage == null ? AppColors.primary : stageColor(stage)) : AppColors.border),
      backgroundColor: AppColors.surface,
    );
  }
}

class _DealTile extends StatelessWidget {
  const _DealTile({required this.deal, required this.onTap});

  final Map<String, dynamic> deal;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final stage = deal['stage'] as String? ?? 'lead';
    final value = (deal['value'] as num?) ?? 0;
    final currency = deal['currency'] as String? ?? 'USD';
    final probability = deal['probability'] as int? ?? 0;

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
                  decoration: BoxDecoration(
                    color: stageColor(stage),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        deal['title'] as String? ?? 'Untitled deal',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          _Badge(text: stageLabel(stage), color: stageColor(stage)),
                          const SizedBox(width: 8),
                          Text(
                            '$probability%',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.mutedForeground),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  formatCurrency(value, currency),
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
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
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}
