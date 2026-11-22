package com.playroamle.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppSettingsPlugin.class); // plugins propios: antes de super.onCreate
        super.onCreate(savedInstanceState);
    }
}
