import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import 'dashboard_screen.dart';

/// Authenticated app shell: a bottom nav bar over an [IndexedStack].
/// Dashboard is the only real tab for v1; the rest are placeholders so
/// adding real tabs later is just a matter of swapping the placeholder
/// widget out of [_tabs].
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _tabs = [
    DashboardScreen(),
    _ComingSoonTab(label: 'Notifications', icon: Icons.notifications_outlined),
    _ComingSoonTab(label: 'Settings', icon: Icons.settings_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        items: [
          _navItem(Icons.dashboard_outlined, Icons.dashboard, 'Dashboard', 0),
          _navItem(Icons.notifications_outlined, Icons.notifications, 'Alerts', 1),
          _navItem(Icons.settings_outlined, Icons.settings, 'Settings', 2),
        ],
      ),
    );
  }

  BottomNavigationBarItem _navItem(
    IconData outlined,
    IconData filled,
    String label,
    int index,
  ) {
    final isActive = _index == index;
    return BottomNavigationBarItem(
      icon: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: isActive ? digitGlow(opacity: 0.3, blurRadius: 14) : null,
        ),
        child: Icon(isActive ? filled : outlined),
      ),
      label: label,
    );
  }
}

class _ComingSoonTab extends StatelessWidget {
  const _ComingSoonTab({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(label)),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: AppColors.mutedForeground),
            const SizedBox(height: 12),
            Text(
              '$label coming soon',
              style: const TextStyle(color: AppColors.mutedForeground),
            ),
          ],
        ),
      ),
    );
  }
}
