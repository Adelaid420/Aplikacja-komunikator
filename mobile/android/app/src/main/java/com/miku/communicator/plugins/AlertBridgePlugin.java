package com.miku.communicator.plugins;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PermissionAlias;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.annotation.PluginMethod;
import com.miku.communicator.MainActivity;
import com.miku.communicator.R;
import com.miku.communicator.notifications.NotificationHelper;

import java.util.concurrent.atomic.AtomicInteger;

@CapacitorPlugin(
  name = "AlertBridge",
  permissions = {
    @PermissionAlias(name = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
  }
)
public class AlertBridgePlugin extends Plugin {
  private static final AtomicInteger COUNTER = new AtomicInteger(4000);
  private final Handler handler = new Handler(Looper.getMainLooper());
  private ToneGenerator toneGenerator;

  @Override
  public void load() {
    NotificationHelper.ensureChannels(getContext());
  }

  @PluginMethod
  public void requestPermission(PluginCall call) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      JSObject result = new JSObject();
      result.put("granted", true);
      call.resolve(result);
      return;
    }
    final Context context = getContext();
    final boolean alreadyGranted =
      NotificationManagerCompat.from(context).areNotificationsEnabled()
        && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
          == PackageManager.PERMISSION_GRANTED;
    if (alreadyGranted) {
      JSObject result = new JSObject();
      result.put("granted", true);
      call.resolve(result);
      return;
    }
    requestPermissionForAlias("notifications", call, "permissionCallback");
  }

  @PermissionCallback
  private void permissionCallback(PluginCall call) {
    JSObject result = new JSObject();
    result.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
    call.resolve(result);
  }

  @PluginMethod
  public void showNotification(PluginCall call) {
    final Context context = getContext();
    final String title = call.getString("title", context.getString(R.string.app_name));
    final String body = call.getString("body", "Otwórz komunikator, aby zobaczyć szczegóły.");
    final String category = call.getString("category", "message");
    final String level = call.getString("level", "message");

    NotificationHelper.ensureChannels(context);

    final Intent intent = new Intent(context, MainActivity.class)
      .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    final PendingIntent pendingIntent = PendingIntent.getActivity(
      context,
      0,
      intent,
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
    );

    final NotificationCompat.Builder builder = new NotificationCompat.Builder(
      context,
      NotificationHelper.resolveChannelId(category, level)
    )
      .setContentTitle(title)
      .setContentText(body)
      .setSmallIcon(R.drawable.ic_stat_miku)
      .setAutoCancel(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setContentIntent(pendingIntent);

    if ("alarm".equals(category)) {
      builder.setCategory(NotificationCompat.CATEGORY_ALARM);
      builder.setFullScreenIntent(pendingIntent, true);
    } else {
      builder.setCategory(NotificationCompat.CATEGORY_MESSAGE);
      builder.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
    }

    NotificationManagerCompat.from(context)
      .notify(COUNTER.incrementAndGet(), builder.build());

    call.resolve();
  }

  @PluginMethod
  public void playAttention(PluginCall call) {
    final String level = call.getString("level", "message");
    handler.post(() -> playTone(level));
    call.resolve();
  }

  private void playTone(String level) {
    final Context context = getContext();
    final AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
    if (audioManager == null) {
      return;
    }

    final int originalMode = audioManager.getRingerMode();
    final int stream = AudioManager.STREAM_ALARM;
    final int originalVolume = audioManager.getStreamVolume(stream);
    final int maxVolume = audioManager.getStreamMaxVolume(stream);

    try {
      audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
      audioManager.setStreamVolume(stream, maxVolume, 0);
    } catch (SecurityException ignored) {
      // Brak uprawnień do modyfikacji profilu dźwięku – kontynuujemy z bieżącymi ustawieniami.
    }

    if (toneGenerator != null) {
      toneGenerator.release();
    }

    final int toneType;
    final int durationMs;
    if ("alarm-urgent".equals(level) || "urgent".equals(level)) {
      toneType = ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD;
      durationMs = 4000;
    } else if ("alarm".equals(level)) {
      toneType = ToneGenerator.TONE_CDMA_ALERT_NETWORK_LITE;
      durationMs = 2500;
    } else {
      toneType = ToneGenerator.TONE_PROP_PROMPT;
      durationMs = 1500;
    }

    toneGenerator = new ToneGenerator(stream, ToneGenerator.MAX_VOLUME);
    toneGenerator.startTone(toneType, durationMs);

    handler.postDelayed(() -> {
      if (toneGenerator != null) {
        toneGenerator.release();
        toneGenerator = null;
      }
      try {
        audioManager.setStreamVolume(stream, originalVolume, 0);
        audioManager.setRingerMode(originalMode);
      } catch (SecurityException ignored) {
        // Użytkownik może nie nadać uprawnień przywrócenia trybu – ignorujemy błąd.
      }
    }, durationMs + 500L);
  }
}
