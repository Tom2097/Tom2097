import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';

/// Real notification list -- same GET /api/v1/notifications and mark-read
/// endpoints the website's bell dropdown uses (components/digit/navbar.tsx),
/// so an event that fires a notification shows up identically on both.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _isLoading = true;
  String? _error;
  List<Map<String, dynamic>> _notifications = [];

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
      final result = await ApiClient.get('/api/v1/notifications?limit=30');
      final list = (result as Map)['notifications'] as List;
      setState(() => _notifications = list.cast<Map<String, dynamic>>());
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to load notifications');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _markRead(Map<String, dynamic> notification) async {
    if (notification['read_at'] != null) return;
    setState(() => notification['read_at'] = DateTime.now().toIso8601String());
    try {
      await ApiClient.patch('/api/v1/notifications/${notification['id']}');
    } catch (_) {
      // Best-effort -- a failed mark-read isn't worth surfacing an error for.
    }
  }

  Future<void> _markAllRead() async {
    final hadUnread = _notifications.any((n) => n['read_at'] == null);
    if (!hadUnread) return;
    setState(() {
      for (final n in _notifications) {
        n['read_at'] ??= DateTime.now().toIso8601String();
      }
    });
    try {
      await ApiClient.post('/api/v1/notifications/read-all');
    } catch (_) {
      // Best-effort, same as above.
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = _notifications.any((n) => n['read_at'] == null);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (hasUnread)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return ListView(
        children: [
          const SizedBox(height: 80),
          Icon(Icons.error_outline, size: 40, color: AppColors.destructive.withValues(alpha: 0.7)),
          const SizedBox(height: 12),
          Center(child: Text(_error!, style: const TextStyle(color: AppColors.destructive))),
        ],
      );
    }
    if (_notifications.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 100),
          Icon(Icons.notifications_off_outlined, size: 40, color: AppColors.mutedForeground),
          SizedBox(height: 12),
          Center(
            child: Text("You're all caught up", style: TextStyle(color: AppColors.mutedForeground)),
          ),
        ],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _notifications.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, i) => _NotificationTile(
        notification: _notifications[i],
        onTap: () => _markRead(_notifications[i]),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});

  final Map<String, dynamic> notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isUnread = notification['read_at'] == null;
    final title = notification['title'] as String? ?? '';
    final body = notification['body'] as String?;
    final createdAt = DateTime.tryParse(notification['created_at'] as String? ?? '');

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (isUnread)
                Container(
                  margin: const EdgeInsets.only(top: 6, right: 10),
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                )
              else
                const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  fontWeight: isUnread ? FontWeight.w600 : FontWeight.w400,
                                  color: isUnread ? AppColors.foreground : AppColors.mutedForeground,
                                ),
                          ),
                        ),
                        if (createdAt != null)
                          Text(
                            _relativeTime(createdAt),
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: AppColors.mutedForeground,
                                ),
                          ),
                      ],
                    ),
                    if (body != null && body.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        body,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.mutedForeground,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _relativeTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${dt.month}/${dt.day}';
  }
}
