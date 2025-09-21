package com.miku.communicator.notifications;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.miku.communicator.MainActivity;
import com.miku.communicator.R;

public final class NotificationHelper {
  public static final String MESSAGE_CHANNEL_ID = "miku_messages";
  public static final String ALARM_CHANNEL_ID = "miku_alarm";
  public static final String FOREGROUND_CHANNEL_ID = "miku_foreground";

  private NotificationHelper() {
  }

  public static void ensureChannels(@NonNull Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }
    final NotificationManager manager = context.getSystemService(NotificationManager.class);
    if (manager == null) {
      return;
    }

    if (manager.getNotificationChannel(MESSAGE_CHANNEL_ID) == null) {
      final NotificationChannel channel = new NotificationChannel(
        MESSAGE_CHANNEL_ID,
        "Wiadomości Miku",
        NotificationManager.IMPORTANCE_HIGH
      );
      channel.setDescription("Natychmiastowe wiadomości partnera/partnerki od Miku.");
      channel.enableVibration(true);
      channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      final AudioAttributes attributes = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build();
      channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), attributes);
      manager.createNotificationChannel(channel);
    }

    if (manager.getNotificationChannel(ALARM_CHANNEL_ID) == null) {
      final NotificationChannel channel = new NotificationChannel(
        ALARM_CHANNEL_ID,
        "Alarmy Miku",
        NotificationManager.IMPORTANCE_HIGH
      );
      channel.setDescription("Pilne alarmy wymagające natychmiastowej reakcji.");
      channel.enableVibration(true);
      channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      final AudioAttributes attributes = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build();
      channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), attributes);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        if (manager.isNotificationPolicyAccessGranted()) {
          channel.setBypassDnd(true);
        }
      }
      manager.createNotificationChannel(channel);
    }

    if (manager.getNotificationChannel(FOREGROUND_CHANNEL_ID) == null) {
      final NotificationChannel channel = new NotificationChannel(
        FOREGROUND_CHANNEL_ID,
        "Usługa w tle Miku",
        NotificationManager.IMPORTANCE_LOW
      );
      channel.setDescription("Zapewnia stałe połączenie Miku w tle 24/7.");
      channel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
      manager.createNotificationChannel(channel);
    }
  }

  public static Notification buildForegroundNotification(@NonNull Context context) {
    ensureChannels(context);
    final PendingIntent pendingIntent = PendingIntent.getActivity(
      context,
      0,
      new Intent(context, MainActivity.class)
        .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP),
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
    );

    return new NotificationCompat.Builder(context, FOREGROUND_CHANNEL_ID)
      .setContentTitle(context.getString(R.string.foreground_service_title))
      .setContentText(context.getString(R.string.foreground_service_message))
      .setSmallIcon(R.drawable.ic_stat_miku)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setContentIntent(pendingIntent)
      .setShowWhen(false)
      .build();
  }

  public static String resolveChannelId(String category, String level) {
    if ("alarm".equals(category)) {
      return ALARM_CHANNEL_ID;
    }
    return MESSAGE_CHANNEL_ID;
  }
}
