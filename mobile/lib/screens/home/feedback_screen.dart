import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'feedback_detail_screen.dart';

const _amber = Color(0xFFF5A623);

/// Matches FEEDBACK_TYPES in lib/feedback/types.ts:8.
const kFeedbackTypes = ['bug', 'feature', 'improvement', 'question', 'general'];

String feedbackTypeLabel(String type) => switch (type) {
      'bug' => 'Bug',
      'feature' => 'Feature',
      'improvement' => 'Improvement',
      'question' => 'Question',
      _ => 'General',
    };

Color feedbackTypeColor(String type) => switch (type) {
      'bug' => AppColors.destructive,
      'feature' => AppColors.primary,
      'improvement' => AppColors.blue,
      'question' => _amber,
      _ => AppColors.mutedForeground,
    };

/// Matches FEEDBACK_STATUSES in lib/feedback/types.ts:9-16.
String feedbackStatusLabel(String status) => switch (status) {
      'open' => 'Open',
      'triaged' => 'Triaged',
      'in_progress' => 'In progress',
      'resolved' => 'Resolved',
      'closed' => 'Closed',
      'wont_fix' => "Won't fix",
      _ => status,
    };

/// Real Feedback: a feature-request/bug board (GET /api/v1/feedback, backed
/// by lib/feedback/engine.ts) with type/status filtering, voting, and
/// comments -- the same public.feedback table the website's board reads.
class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic>? _stats;
  List<Map<String, dynamic>> _items = [];
  String? _typeFilter;

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
      final path = _typeFilter == null ? '/api/v1/feedback?sort=votes' : '/api/v1/feedback?sort=votes&type=$_typeFilter';
      final result = await ApiClient.get(path);
      setState(() {
        _stats = (result as Map)['stats'] as Map<String, dynamic>;
        _items = (result['items'] as List).cast<Map<String, dynamic>>();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to load feedback');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _selectType(String? type) async {
    setState(() => _typeFilter = type);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Feedback')),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _isLoading && _stats == null
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _stats == null
                ? ListView(
                    children: [
                      const SizedBox(height: 80),
                      Center(child: Text(_error!, style: const TextStyle(color: AppColors.destructive))),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_stats != null) _StatsCard(stats: _stats!),
                      const SizedBox(height: 20),
                      _TypeFilterRow(selected: _typeFilter, onSelect: _selectType),
                      const SizedBox(height: 12),
                      if (_items.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 60),
                          child: Center(child: Text('No feedback yet', style: TextStyle(color: AppColors.mutedForeground))),
                        )
                      else
                        ..._items.map((item) => _FeedbackTile(
                              item: item,
                              onTap: () async {
                                await Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => FeedbackDetailScreen(feedback: item)),
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

class _StatsCard extends StatelessWidget {
  const _StatsCard({required this.stats});

  final Map<String, dynamic> stats;

  @override
  Widget build(BuildContext context) {
    final open = stats['openItems'] as int? ?? 0;
    final total = stats['totalItems'] as int? ?? 0;
    final sentiment = stats['sentimentScore'] as int? ?? 0;
    final responseRate = stats['responseRate'] as int? ?? 0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(child: _StatColumn(label: 'Open', value: '$open / $total')),
            Container(width: 1, height: 36, color: AppColors.border),
            Expanded(child: _StatColumn(label: 'Sentiment', value: '$sentiment%')),
            Container(width: 1, height: 36, color: AppColors.border),
            Expanded(child: _StatColumn(label: 'Response rate', value: '$responseRate%')),
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

class _TypeFilterRow extends StatelessWidget {
  const _TypeFilterRow({required this.selected, required this.onSelect});

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
          for (final type in kFeedbackTypes) ...[
            _chip(context, type, feedbackTypeLabel(type)),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }

  Widget _chip(BuildContext context, String? type, String label) {
    final isSelected = selected == type;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => onSelect(type),
      selectedColor: (type == null ? AppColors.primary : feedbackTypeColor(type)).withValues(alpha: 0.2),
      labelStyle: TextStyle(
        color: isSelected ? AppColors.foreground : AppColors.mutedForeground,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
      ),
      side: BorderSide(color: isSelected ? (type == null ? AppColors.primary : feedbackTypeColor(type)) : AppColors.border),
      backgroundColor: AppColors.surface,
    );
  }
}

class _FeedbackTile extends StatelessWidget {
  const _FeedbackTile({required this.item, required this.onTap});

  final Map<String, dynamic> item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final type = item['type'] as String? ?? 'general';
    final status = item['status'] as String? ?? 'open';
    final voteCount = item['vote_count'] as int? ?? 0;

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
                Column(
                  children: [
                    const Icon(Icons.arrow_upward, size: 14, color: AppColors.mutedForeground),
                    Text('$voteCount', style: Theme.of(context).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item['title'] as String? ?? 'Untitled', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          _Badge(text: feedbackTypeLabel(type), color: feedbackTypeColor(type)),
                          const SizedBox(width: 6),
                          Text(feedbackStatusLabel(status), style: const TextStyle(color: AppColors.mutedForeground, fontSize: 11)),
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
