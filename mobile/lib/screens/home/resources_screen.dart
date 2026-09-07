import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'kb_article_screen.dart';

IconData fileTypeIcon(String? type) {
  final t = (type ?? '').toLowerCase();
  if (t.contains('pdf')) return Icons.picture_as_pdf_outlined;
  if (t.contains('image') || t.contains('png') || t.contains('jpg') || t.contains('jpeg')) return Icons.image_outlined;
  if (t.contains('sheet') || t.contains('excel') || t.contains('csv')) return Icons.table_chart_outlined;
  if (t.contains('word') || t.contains('doc')) return Icons.description_outlined;
  return Icons.insert_drive_file_outlined;
}

/// Real Resources: the company document library (GET/download
/// /api/v1/resources/documents) and knowledge base (GET /api/v1/kb/articles,
/// backed by lib/kb/engine.ts -- restored from a stub alongside this screen,
/// not the separate and still-broken /api/v1/resources/kb/articles route,
/// which duplicates the same table against the wrong column names).
/// app/(dashboard)/resources's own web page covers physical-asset tracking
/// instead, which has no GET route yet and is out of scope here.
class ResourcesScreen extends StatefulWidget {
  const ResourcesScreen({super.key});

  @override
  State<ResourcesScreen> createState() => _ResourcesScreenState();
}

class _ResourcesScreenState extends State<ResourcesScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Resources'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Documents'),
            Tab(text: 'Knowledge base'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [_DocumentsTab(), _KbArticlesTab()],
      ),
    );
  }
}

class _DocumentsTab extends StatefulWidget {
  const _DocumentsTab();

  @override
  State<_DocumentsTab> createState() => _DocumentsTabState();
}

class _DocumentsTabState extends State<_DocumentsTab> {
  bool _isLoading = true;
  String? _error;
  List<Map<String, dynamic>> _documents = [];
  String? _openingId;

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
      final result = await ApiClient.get('/api/v1/resources/documents?limit=50');
      setState(() => _documents = ((result as Map)['data'] as List).cast<Map<String, dynamic>>());
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to load documents');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _open(Map<String, dynamic> doc) async {
    setState(() => _openingId = doc['id'] as String?);
    try {
      final result = await ApiClient.get('/api/v1/resources/documents/${doc['id']}/download');
      final url = (result as Map)['url'] as String?;
      if (url == null) throw Exception('No download URL returned');
      final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!ok && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open document')));
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to open document')));
    } finally {
      if (mounted) setState(() => _openingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: _isLoading && _documents.isEmpty && _error == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _documents.isEmpty
              ? ListView(
                  children: [
                    const SizedBox(height: 80),
                    Center(child: Text(_error!, style: const TextStyle(color: AppColors.destructive))),
                  ],
                )
              : _documents.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 80),
                        Center(child: Text('No documents yet', style: TextStyle(color: AppColors.mutedForeground))),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _documents.length,
                      itemBuilder: (context, i) {
                        final doc = _documents[i];
                        final tags = (doc['tags'] as List?)?.cast<String>() ?? const [];
                        final isOpening = _openingId == doc['id'];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Card(
                            child: ListTile(
                              leading: Icon(fileTypeIcon(doc['mime_type'] as String?), color: AppColors.primary),
                              title: Text(doc['name'] as String? ?? 'Untitled', maxLines: 1, overflow: TextOverflow.ellipsis),
                              subtitle: tags.isEmpty ? null : Text(tags.join(', '), maxLines: 1, overflow: TextOverflow.ellipsis),
                              trailing: isOpening
                                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                  : const Icon(Icons.open_in_new, size: 18, color: AppColors.mutedForeground),
                              onTap: isOpening ? null : () => _open(doc),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}

class _KbArticlesTab extends StatefulWidget {
  const _KbArticlesTab();

  @override
  State<_KbArticlesTab> createState() => _KbArticlesTabState();
}

class _KbArticlesTabState extends State<_KbArticlesTab> {
  bool _isLoading = true;
  String? _error;
  List<Map<String, dynamic>> _articles = [];

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
      final result = await ApiClient.get('/api/v1/kb/articles?limit=50&status=published');
      setState(() => _articles = ((result as Map)['articles'] as List).cast<Map<String, dynamic>>());
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to load articles');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: _isLoading && _articles.isEmpty && _error == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _articles.isEmpty
              ? ListView(
                  children: [
                    const SizedBox(height: 80),
                    Center(child: Text(_error!, style: const TextStyle(color: AppColors.destructive))),
                  ],
                )
              : _articles.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 80),
                        Center(child: Text('No published articles yet', style: TextStyle(color: AppColors.mutedForeground))),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _articles.length,
                      itemBuilder: (context, i) {
                        final article = _articles[i];
                        final tags = (article['tags'] as List?)?.cast<String>() ?? const [];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Card(
                            child: ListTile(
                              leading: const Icon(Icons.article_outlined, color: AppColors.primary),
                              title: Text(article['title'] as String? ?? 'Untitled', maxLines: 1, overflow: TextOverflow.ellipsis),
                              subtitle: tags.isEmpty ? null : Text(tags.join(', '), maxLines: 1, overflow: TextOverflow.ellipsis),
                              trailing: const Icon(Icons.chevron_right, color: AppColors.mutedForeground),
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => KbArticleScreen(article: article)),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
