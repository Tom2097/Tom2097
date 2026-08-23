// Basic smoke test: the app boots to the splash screen without throwing.
// Supabase.initialize() requires network/plugin bindings that aren't
// available in the plain widget-test harness, so this test builds the
// splash UI directly rather than the full `DigitApp` (which calls
// Supabase.initialize() in main()).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:digit_mobile/theme/app_theme.dart';
import 'package:digit_mobile/widgets/digit_logo.dart';

void main() {
  testWidgets('DigitLogo renders the DigiT wordmark', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark,
        home: const Scaffold(body: Center(child: DigitLogo())),
      ),
    );

    expect(find.text('DigiT'), findsOneWidget);
  });
}
