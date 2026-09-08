import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'compliance_screen.dart';

/// Matches TRANSITIONS in lib/compliance/capa.ts:29-35 -- only these moves
/// are ever accepted server-side, so the picker only offers these.
const _transitions = <String, List<String>>{
  'open': ['investigation'],
  'investigation': ['action', 'open'],
  'action': ['verification', 'investigation'],
  'verification': ['closed', 'action'],
  'closed': [],
};

/// Single-CAPA view + a real status-transition action (PATCH
/// /api/v1/compliance/capas/[id]). Closing a major/critical CAPA is an
/// authority-gated action server-side (lib/compliance/capa.ts's
/// requestCapaClosure) -- this surfaces that as "pending sign-off" rather
/// than a hard failure.
class CapaDetailScreen extends StatefulWidget {
  const CapaDetailScreen({super.key, required this.capa});

  final Map<String, dynamic> capa;

  @override
  State<CapaDetailScreen> createState() => _CapaDetailScreenState();
}

class _CapaDetailScreenState extends State<CapaDetailScreen> {
  late Map<String, dynamic> _capa;
  bool _isSaving = false;
  String? _error;
  String? _info;

  @override
  void initState() {
    super.initState();
    _capa = Map<String, dynamic>.from(widget.capa);
  }

  Future<void> _changeStatus() async {
    final currentStatus = _capa['status'] as String? ?? 'open';
    final options = _transitions[currentStatus] ?? const [];
    if (options.isEmpty) return;

    final result = await showModalBottomSheet<(String, String?)>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (context) => _TransitionSheet(options: options),
    );
    if (result == null) return;
    final (newStatus, notes) = result;

    setState(() {
      _isSaving = true;
      _error = null;
      _info = null;
    });
    try {
      final response = await ApiClient.patch(
        '/api/v1/compliance/capas/${_capa['id']}',
        body: {'status': newStatus, 'notes': notes},
      );
      if (response is Map && response['pendingApproval'] == true) {
        setState(() => _info = response['message'] as String? ?? 'Closure requires sign-off.');
      } else if (response is Map) {
        setState(() => _capa = Map<String, dynamic>.from(response));
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Moved to ${capaStatusLabel(newStatus)}')),
          );
        }
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Failed to update CAPA');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final severity = _capa['severity'] as String? ?? 'minor';
    final status = _capa['status'] as String? ?? 'open';
    final description = _capa['description'] as String?;
    final investigationNotes = _capa['investigation_notes'] as String?;
    final actionTaken = _capa['action_taken'] as String?;
    final verificationNotes = _capa['verification_notes'] as String?;
    final canTransition = (_transitions[status] ?? const []).isNotEmpty;

    return Scaffold(
      appBar: AppBar(title: const Text('CAPA')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            _capa['title'] as String? ?? 'Untitled CAPA',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _Badge(text: severity.toUpperCase(), color: capaSeverityColor(severity)),
              const SizedBox(width: 10),
              _Badge(text: capaStatusLabel(status), color: AppColors.blue),
            ],
          ),
          if (description != null && description.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text('Description', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: AppColors.mutedForeground)),
            const SizedBox(height: 6),
            Text(description),
          ],
          if (investigationNotes != null && investigationNotes.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Investigation notes', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: AppColors.mutedForeground)),
            const SizedBox(height: 6),
            Text(investigationNotes),
          ],
          if (actionTaken != null && actionTaken.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Action taken', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: AppColors.mutedForeground)),
            const SizedBox(height: 6),
            Text(actionTaken),
          ],
          if (verificationNotes != null && verificationNotes.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Verification notes', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: AppColors.mutedForeground)),
            const SizedBox(height: 6),
            Text(verificationNotes),
          ],
          if (_info != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.blue.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
              child: Text(_info!, style: const TextStyle(color: AppColors.blue)),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: AppColors.destructive)),
          ],
          if (canTransition) ...[
            const SizedBox(height: 28),
            FilledButton.icon(
              onPressed: _isSaving ? null : _changeStatus,
              icon: _isSaving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.swap_horiz),
              label: Text(_isSaving ? 'Updating…' : 'Change status'),
            ),
          ],
        ],
      ),
    );
  }
}

class _TransitionSheet extends StatefulWidget {
  const _TransitionSheet({required this.options});

  final List<String> options;

  @override
  State<_TransitionSheet> createState() => _TransitionSheetState();
}

class _TransitionSheetState extends State<_TransitionSheet> {
  String? _selected;
  final _notesController = TextEditingController();

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Move to status', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            for (final status in widget.options)
              ListTile(
                title: Text(capaStatusLabel(status)),
                trailing: _selected == status ? const Icon(Icons.check, color: AppColors.primary) : null,
                onTap: () => setState(() => _selected = status),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _notesController,
                decoration: const InputDecoration(labelText: 'Notes (optional)'),
                maxLines: 2,
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _selected == null
                      ? null
                      : () => Navigator.of(context).pop((_selected!, _notesController.text.isEmpty ? null : _notesController.text)),
                  child: const Text('Confirm'),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
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
