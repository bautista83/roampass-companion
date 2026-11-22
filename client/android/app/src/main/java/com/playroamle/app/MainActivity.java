package com.playroamle.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppSettingsPlugin.class); // plugins propios: antes de super.onCreate
        super.onCreate(savedInstanceState);
        createPushChannel();
    }

    /**
     * Canal "roamle" de las notificaciones push (docs/specs/mobile-app.md, E4): el servidor manda
     * todo por este canal. Prioridad alta, con sonido y vibracion. Android 8+.
     */
    private void createPushChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            "roamle",
            getString(R.string.push_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(getString(R.string.push_channel_description));
        channel.enableVibration(true);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }
}
