package com.jellify.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import com.jellify.app.plugins.JellifyPlayerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(JellifyPlayerPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#121212"));
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
    }
}
