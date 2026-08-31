import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'api_client.dart';

/// Push notification registration -- the Flutter-side half of the push
/// infrastructure already live on the backend (lib/notifications/push.ts
/// and the device_tokens table, both built earlier). This only handles
/// getting a token onto a device and telling the backend about it; the
/// backend already knows how to send to it the moment any event that
/// already creates an in-app notification fires (see
/// lib/notifications/engine.ts's pushToAllowedRecipients()).
class PushService {
  PushService._();

  static bool _registered = false;

  /// Requests permission, gets the current FCM token, registers it with
  /// POST /api/v1/notifications/devices, and keeps it in sync if FCM
  /// rotates the token later. Call once, after a session exists (there's no
  /// point registering a device before the backend can attribute it to a
  /// user) -- HomeShell does this in initState.
  static Future<void> registerDevice() async {
    if (_registered) return;
    _registered = true;

    try {
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        // The user can still use the app fully without push -- this is a
        // silent no-op, not an error state.
        return;
      }

      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await _sendToken(token);
      }

      FirebaseMessaging.instance.onTokenRefresh.listen(_sendToken);
    } catch (e) {
      // Push is a best-effort enhancement, never something that should
      // block sign-in or navigation if it fails (e.g. no Play Services on
      // an emulator, or Firebase misconfigured).
      debugPrint('[push] registration failed: $e');
    }
  }

  static Future<void> _sendToken(String token) async {
    try {
      await ApiClient.post(
        '/api/v1/notifications/devices',
        body: {
          'token': token,
          'platform': Platform.isIOS ? 'ios' : 'android',
        },
      );
    } catch (e) {
      debugPrint('[push] failed to register device token: $e');
    }
  }

  /// Best-effort unregister so a signed-out device stops receiving push
  /// meant for the account it just left. Call before/around sign-out.
  static Future<void> unregisterDevice() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await ApiClient.delete('/api/v1/notifications/devices', body: {'token': token});
      }
    } catch (e) {
      debugPrint('[push] failed to unregister device token: $e');
    } finally {
      _registered = false;
    }
  }
}
