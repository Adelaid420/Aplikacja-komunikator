package com.miku.communicator.background;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

/**
 * Ensures the foreground service is relaunched automatically after boot or app updates so the
 * communicator stays online around the clock.
 */
public class BootCompletedReceiver extends BroadcastReceiver {

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null) {
      return;
    }
    final String action = intent.getAction();
    if (action == null) {
      return;
    }

    switch (action) {
      case Intent.ACTION_BOOT_COMPLETED:
      case Intent.ACTION_LOCKED_BOOT_COMPLETED:
      case Intent.ACTION_MY_PACKAGE_REPLACED:
        final Intent serviceIntent = new Intent(context, MikuForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          ContextCompat.startForegroundService(context, serviceIntent);
        } else {
          context.startService(serviceIntent);
        }
        break;
      default:
        break;
    }
  }
}
