package com.miku.communicator;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.miku.communicator.background.MikuForegroundService;
import com.miku.communicator.plugins.AlertBridgePlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(AlertBridgePlugin.class);
    super.onCreate(savedInstanceState);
    final Intent serviceIntent = new Intent(this, MikuForegroundService.class);
    ContextCompat.startForegroundService(this, serviceIntent);
    requestBatteryOptimizationException();
  }

  private void requestBatteryOptimizationException() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return;
    }
    final PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
    if (powerManager == null) {
      return;
    }
    final String packageName = getPackageName();
    if (powerManager.isIgnoringBatteryOptimizations(packageName)) {
      return;
    }
    final Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
      .setData(Uri.parse("package:" + packageName))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    startActivity(intent);
  }
}
