import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Read-only article view. Matches Article in lib/kb/types.ts -- "body" is
/// plain text (no rich markup to render), and category is only a category_id
/// FK with no name embedded in this response, so tags carry the topical info
/// shown here instead.
class KbArticleScreen extends StatelessWidget {
  const KbArticleScreen({super.key, required this.article});

  final Map<String, dynamic> article;

  @override
  Widget build(BuildContext context) {
    final tags = (article['tags'] as List?)?.cast<String>() ?? const [];

    return Scaffold(
      appBar: AppBar(title: const Text('Article')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            article['title'] as String? ?? 'Untitled',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          if (article['excerpt'] != null && (article['excerpt'] as String).isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(article['excerpt'] as String, style: const TextStyle(color: AppColors.mutedForeground)),
          ],
          if (tags.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: tags.map((t) => Chip(label: Text(t))).toList()),
          ],
          const SizedBox(height: 20),
          Text(
            article['body'] as String? ?? '',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5),
          ),
        ],
      ),
    );
  }
}
