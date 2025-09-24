package com.miku.communicator.background;

import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import com.miku.communicator.notifications.NotificationHelper;

public class MikuForegroundService extends Service {
  private static final int NOTIFICATION_ID = 1337;
  private static final long KEEP_ALIVE_INTERVAL_MS = 15 * 60 * 1000L; // 15 minut
  private static final String ACTION_KEEP_ALIVE = "com.miku.communicator.action.KEEP_ALIVE";

  private PowerManager.WakeLock wakeLock;
  private WifiManager.WifiLock wifiLock;
  private AlarmManager alarmManager;
  private PendingIntent keepAliveIntent;

  @Override
  public void onCreate() {
    super.onCreate();
    startForeground(NOTIFICATION_ID, NotificationHelper.buildForegroundNotification(this));
    acquireLocks();
    scheduleKeepAlive();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    scheduleKeepAlive();
    return START_STICKY;
  }

  @Override
  public void onTaskRemoved(Intent rootIntent) {
    final Intent restartServiceIntent = new Intent(getApplicationContext(), getClass());
    ContextCompat.startForegroundService(getApplicationContext(), restartServiceIntent);
    scheduleKeepAlive();
    super.onTaskRemoved(rootIntent);
  }

  @Override
  public void onDestroy() {
    stopForeground(true);
    cancelKeepAlive();
    releaseLocks();
    super.onDestroy();
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @SuppressLint("WakelockTimeout")
  private void acquireLocks() {
    final PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
    if (powerManager != null && (wakeLock == null || !wakeLock.isHeld())) {
      wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MikuForegroundService:WakeLock");
      wakeLock.setReferenceCounted(false);
      wakeLock.acquire();
    }

    final WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
    if (wifiManager != null && (wifiLock == null || !wifiLock.isHeld())) {
      wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MikuForegroundService:WifiLock");
      wifiLock.setReferenceCounted(false);
      wifiLock.acquire();
    }
  }

  private void releaseLocks() {
    if (wakeLock != null && wakeLock.isHeld()) {
      wakeLock.release();
    }
    wakeLock = null;

    if (wifiLock != null && wifiLock.isHeld()) {
      wifiLock.release();
    }
    wifiLock = null;
  }

  private void scheduleKeepAlive() {
    if (alarmManager == null) {
      alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
    }
    if (alarmManager == null) {
      return;
    }

    final PendingIntent intent = buildKeepAliveIntent();
    final long triggerAt = System.currentTimeMillis() + KEEP_ALIVE_INTERVAL_MS;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, intent);
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
      alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, intent);
    } else {
      alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, intent);
    }
  }

  private void cancelKeepAlive() {
    if (alarmManager != null && keepAliveIntent != null) {
      alarmManager.cancel(keepAliveIntent);
    }
  }

  private PendingIntent buildKeepAliveIntent() {
    if (keepAliveIntent != null) {
      return keepAliveIntent;
    }

    final Intent intent = new Intent(getApplicationContext(), MikuForegroundService.class).setAction(ACTION_KEEP_ALIVE);
    final int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      keepAliveIntent = PendingIntent.getForegroundService(getApplicationContext(), 0, intent, flags);
    } else {
      keepAliveIntent = PendingIntent.getService(getApplicationContext(), 0, intent, flags);
    }
    return keepAliveIntent;
  }
}
