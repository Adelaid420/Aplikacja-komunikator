package com.miku.communicator.background;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import com.miku.communicator.notifications.NotificationHelper;

public class MikuForegroundService extends Service {
  private static final int NOTIFICATION_ID = 1337;

  @Override
  public void onCreate() {
    super.onCreate();
    startForeground(NOTIFICATION_ID, NotificationHelper.buildForegroundNotification(this));
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    return START_STICKY;
  }

  @Override
  public void onTaskRemoved(Intent rootIntent) {
    final Intent restartServiceIntent = new Intent(getApplicationContext(), getClass());
    ContextCompat.startForegroundService(getApplicationContext(), restartServiceIntent);
    super.onTaskRemoved(rootIntent);
  }

  @Override
  public void onDestroy() {
    stopForeground(true);
    super.onDestroy();
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
