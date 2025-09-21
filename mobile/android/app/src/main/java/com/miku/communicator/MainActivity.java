package com.miku.communicator;

import android.content.Intent;
import android.os.Bundle;

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
  }
}
