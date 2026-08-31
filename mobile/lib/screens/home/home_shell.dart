import 'package:flutter/material.dart';

import '../../services/push_service.dart';
import '../../theme/app_theme.dart';
import 'crm_screen.dart';
import 'dashboard_screen.dart';
import 'notifications_screen.dart';
import 'settings_screen.dart';

/// Authenticated app shell: a bottom nav bar over an [IndexedStack]. All
/// four tabs are real -- Dashboard, CRM (the first real product module,
/// backed by GET /api/v1/crm/pipeline + /api/v1/crm/deals), Notifications
/// (same GET /api/v1/notifications the website's bell uses), and Settings.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _tabs = [
    DashboardScreen(),
    CrmScreen(),
    NotificationsScreen(),
    SettingsScreen(),
  ];

  @override
  void initState() {
    super.initState();
    // Registering here (rather than immediately after sign-in) means it
    // also covers a returning user who already had a session on launch --
    // every path that reaches the authenticated shell ends up here.
    PushService.registerDevice();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        items: [
          _navItem(Icons.dashboard_outlined, Icons.dashboard, 'Dashboard', 0),
          _navItem(Icons.people_alt_outlined, Icons.people_alt, 'CRM', 1),
          _navItem(Icons.notifications_outlined, Icons.notifications, 'Alerts', 2),
          _navItem(Icons.settings_outlined, Icons.settings, 'Settings', 3),
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
