import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'feedback_screen.dart';

/// Single feedback item: vote toggle (POST .../vote) + comments
/// (GET/POST .../comments) -- matches lib/feedback/engine.ts's shape.
class FeedbackDetailScreen extends StatefulWidget {
  const FeedbackDetailScreen({super.key, required this.feedback});

  final Map<String, dynamic> feedback;

  @override
  State<FeedbackDetailScreen> createState() => _FeedbackDetailScreenState();
}

class _FeedbackDetailScreenState extends State<FeedbackDetailScreen> {
  late Map<String, dynamic> _feedback;
  bool _isVoting = false;
  bool _isCommentsLoading = true;
  bool _isPostingComment = false;
  List<Map<String, dynamic>> _comments = [];
  final _commentController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _feedback = Map<String, dynamic>.from(widget.feedback);
    _loadComments();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _loadComments() async {
    setState(() => _isCommentsLoading = true);
    try {
      final result = await ApiClient.get('/api/v1/feedback/${_feedback['id']}/comments');
      setState(() => _comments = ((result as Map)['comments'] as List).cast<Map<String, dynamic>>());
    } catch (_) {
      // Non-fatal -- the feedback item itself still renders.
    } finally {
      if (mounted) setState(() => _isCommentsLoading = false);
    }
  }

  Future<void> _vote() async {
    setState(() => _isVoting = true);
    try {
      final result = await ApiClient.post('/api/v1/feedback/${_feedback['id']}/vote');
      final voteCount = (result is Map) ? result['voteCount'] as int? : null;
      if (voteCount != null) {
        setState(() => _feedback = {..._feedback, 'vote_count': voteCount});
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to vote')));
    } finally {
      if (mounted) setState(() => _isVoting = false);
    }
  }

  Future<void> _postComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;
    setState(() => _isPostingComment = true);
    try {
      final result = await ApiClient.post('/api/v1/feedback/${_feedback['id']}/comments', body: {'text': text});
      final comment = (result is Map && result['comment'] is Map) ? Map<String, dynamic>.from(result['comment'] as Map) : null;
      if (comment != null) {
        setState(() {
          _comments = [..._comments, comment];
          _commentController.clear();
        });
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to post comment')));
    } finally {
      if (mounted) setState(() => _isPostingComment = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final type = _feedback['type'] as String? ?? 'general';
    final status = _feedback['status'] as String? ?? 'open';
    final body = _feedback['body'] as String?;
    final voteCount = _feedback['vote_count'] as int? ?? 0;

    return Scaffold(
      appBar: AppBar(title: const Text('Feedback')),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        _feedback['title'] as String? ?? 'Untitled',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: _isVoting ? null : _vote,
                      icon: _isVoting
                          ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.arrow_upward, size: 16),
                      label: Text('$voteCount'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _Badge(text: feedbackTypeLabel(type), color: feedbackTypeColor(type)),
                    const SizedBox(width: 10),
                    Text(feedbackStatusLabel(status), style: const TextStyle(color: AppColors.mutedForeground)),
                  ],
                ),
                if (body != null && body.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Text(body, style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5)),
                ],
                const SizedBox(height: 28),
                Text('Comments', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                if (_isCommentsLoading)
                  const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 20), child: CircularProgressIndicator()))
                else if (_comments.isEmpty)
                  const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('No comments yet', style: TextStyle(color: AppColors.mutedForeground)))
                else
                  ..._comments.map((c) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Text(c['body'] as String? ?? ''),
                          ),
                        ),
                      )),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _commentController,
                      decoration: const InputDecoration(hintText: 'Add a comment…'),
                      minLines: 1,
                      maxLines: 3,
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _isPostingComment ? null : _postComment,
                    icon: _isPostingComment
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.send),
                  ),
                ],
              ),
            ),
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
