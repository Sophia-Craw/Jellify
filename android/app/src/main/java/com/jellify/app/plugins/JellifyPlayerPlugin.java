package com.jellify.app.plugins;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.Manifest;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.util.Log;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PermissionState;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.MoreExecutors;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "JellifyPlayer",
    permissions = {
        @Permission(strings = { Manifest.permission.FOREGROUND_SERVICE }, alias = "foreground_service")
    }
)
public class JellifyPlayerPlugin extends Plugin {

    private static final String TAG = "JellifyPlayerPlugin";

    private ListenableFuture<MediaController> mediaControllerFuture;
    private MediaController mediaController;

    @Override
    public void load() {
        super.load();
        createNotificationChannel();
        JellifyPlayerService.setStateChangeListener(state -> {
            JSObject ret = new JSObject();
            ret.put("isPlaying", state.isPlaying);
            ret.put("currentIndex", state.currentIndex);
            ret.put("queueSize", state.queueSize);
            ret.put("repeatMode", state.repeatMode);
            ret.put("shuffleEnabled", state.shuffleEnabled);
            notifyListeners("playerStateChange", ret);
        });
    }

    @PluginMethod
    public void setQueue(PluginCall call) {
        runOnService(call, service -> {
            JSArray jsItems = call.getArray("items");
            int startIndex = call.getInt("startIndex", 0);
            JSONArray jsonItems = new JSONArray();
            if (jsItems != null) {
                for (int i = 0; i < jsItems.length(); i++) {
                    JSONObject jsItem = jsItems.getJSONObject(i);
                    JSONObject jsonItem = new JSONObject();
                    jsonItem.put("id", jsItem.optString("id", ""));
                    jsonItem.put("url", jsItem.optString("url", ""));
                    jsonItem.put("title", jsItem.optString("title", ""));
                    jsonItem.put("artist", jsItem.optString("artist", ""));
                    jsonItem.put("album", jsItem.optString("album", ""));
                    jsonItem.put("artworkUrl", jsItem.optString("artworkUrl", ""));
                    jsonItems.put(jsonItem);
                }
            }
            List<QueueItem> items = new ArrayList<>();
            for (int i = 0; i < jsonItems.length(); i++) {
                items.add(QueueItem.fromJson(jsonItems.getJSONObject(i)));
            }
            service.setQueue(items, startIndex);
            call.resolve();
        });
    }

    @PluginMethod
    public void replaceQueue(PluginCall call) {
        runOnService(call, service -> {
            JSArray jsItems = call.getArray("items");
            int currentIndex = call.getInt("currentIndex", 0);
            JSONArray jsonItems = new JSONArray();
            if (jsItems != null) {
                for (int i = 0; i < jsItems.length(); i++) {
                    JSONObject jsItem = jsItems.getJSONObject(i);
                    JSONObject jsonItem = new JSONObject();
                    jsonItem.put("id", jsItem.optString("id", ""));
                    jsonItem.put("url", jsItem.optString("url", ""));
                    jsonItem.put("title", jsItem.optString("title", ""));
                    jsonItem.put("artist", jsItem.optString("artist", ""));
                    jsonItem.put("album", jsItem.optString("album", ""));
                    jsonItem.put("artworkUrl", jsItem.optString("artworkUrl", ""));
                    jsonItems.put(jsonItem);
                }
            }
            List<QueueItem> items = new ArrayList<>();
            for (int i = 0; i < jsonItems.length(); i++) {
                items.add(QueueItem.fromJson(jsonItems.getJSONObject(i)));
            }
            service.replaceQueue(items, currentIndex);
            call.resolve();
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        runOnService(call, service -> {
            service.play();
            call.resolve();
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        runOnService(call, service -> {
            service.pause();
            call.resolve();
        });
    }

    @PluginMethod
    public void next(PluginCall call) {
        runOnService(call, service -> {
            service.next();
            call.resolve();
        });
    }

    @PluginMethod
    public void prev(PluginCall call) {
        runOnService(call, service -> {
            service.prev();
            call.resolve();
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        runOnService(call, service -> {
            Double timeSec = call.getDouble("timeSec", 0.0);
            service.seekTo((long) (timeSec * 1000));
            call.resolve();
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        runOnService(call, service -> {
            Double vol = call.getDouble("volume", 1.0);
            service.setVolume(vol.floatValue());
            call.resolve();
        });
    }

    @PluginMethod
    public void getCurrentTime(PluginCall call) {
        runOnService(call, service -> {
            call.resolve(new JSObject().put("currentTime", service.getCurrentTimeSec()));
        });
    }

    @PluginMethod
    public void getDuration(PluginCall call) {
        runOnService(call, service -> {
            call.resolve(new JSObject().put("duration", service.getDurationSec()));
        });
    }

    @PluginMethod
    public void getPlayerState(PluginCall call) {
        runOnService(call, service -> {
            JSObject state = new JSObject();
            state.put("isPlaying", service.isPlaying());
            state.put("currentIndex", service.getCurrentIndex());
            state.put("queueSize", service.getQueueSize());
            state.put("repeatMode", service.getRepeatMode());
            state.put("currentTime", service.getCurrentTimeSec());
            state.put("duration", service.getDurationSec());
            state.put("shuffleEnabled", service.isShuffleMode());
            call.resolve(state);
        });
    }

    @PluginMethod
    public void setRepeatMode(PluginCall call) {
        runOnService(call, service -> {
            service.setRepeatMode(call.getInt("mode", 0));
            call.resolve();
        });
    }

    @PluginMethod
    public void addToQueue(PluginCall call) {
        runOnService(call, service -> {
            JSArray jsItems = call.getArray("items");
            int atIndex = call.getInt("atIndex", -1);
            JSONArray jsonItems = new JSONArray();
            if (jsItems != null) {
                for (int i = 0; i < jsItems.length(); i++) {
                    JSONObject jsItem = jsItems.getJSONObject(i);
                    JSONObject jsonItem = new JSONObject();
                    jsonItem.put("id", jsItem.optString("id", ""));
                    jsonItem.put("url", jsItem.optString("url", ""));
                    jsonItem.put("title", jsItem.optString("title", ""));
                    jsonItem.put("artist", jsItem.optString("artist", ""));
                    jsonItem.put("album", jsItem.optString("album", ""));
                    jsonItem.put("artworkUrl", jsItem.optString("artworkUrl", ""));
                    jsonItems.put(jsonItem);
                }
            }
            List<QueueItem> items = new ArrayList<>();
            for (int i = 0; i < jsonItems.length(); i++) {
                items.add(QueueItem.fromJson(jsonItems.getJSONObject(i)));
            }
            service.addToQueue(items, atIndex);
            call.resolve();
        });
    }

    @PluginMethod
    public void requestBatteryOptimization(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) { call.resolve(new JSObject().put("exempt", false)); return; }
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        if (pm == null) { call.resolve(new JSObject().put("exempt", false)); return; }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.resolve(new JSObject().put("exempt", true));
            return;
        }

        boolean exempt = pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
        call.resolve(new JSObject().put("exempt", exempt));

        if (!exempt) {
            try {
                Intent intent = new Intent(
                    android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + ctx.getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                Activity activity = getActivity();
                if (activity != null) {
                    activity.startActivity(intent);
                } else {
                    Log.w(TAG, "No Activity context - cannot launch battery optimization prompt");
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to open battery settings", e);
            }
        }
    }

    @PluginMethod
    public void removeFromQueue(PluginCall call) {
        runOnService(call, service -> {
            service.removeFromQueue(call.getInt("index", -1));
            call.resolve();
        });
    }

    @PluginMethod
    public void reorderQueue(PluginCall call) {
        runOnService(call, service -> {
            service.reorderQueue(
                call.getInt("fromIndex", -1),
                call.getInt("toIndex", -1)
            );
            call.resolve();
        });
    }

    @PluginMethod
    public void setShuffle(PluginCall call) {
        runOnService(call, service -> {
            service.setShuffleMode(call.getBoolean("enabled", false));
            call.resolve();
        });
    }

    @PluginMethod
    public void getCurrentOutputDevice(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) { call.resolve(new JSObject().put("name", Build.MODEL)); return; }

        AudioManager audioManager = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) { call.resolve(new JSObject().put("name", Build.MODEL)); return; }

        AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
        String deviceName = null;

        // Prefer Bluetooth A2DP (music-quality Bluetooth)
        for (AudioDeviceInfo d : devices) {
            int type = d.getType();
            if (type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) {
                CharSequence name = d.getProductName();
                if (name != null && name.length() > 0) {
                    deviceName = name.toString();
                } else {
                    deviceName = "Bluetooth";
                }
                break;
            }
        }

        // Fallback to wired headphones
        if (deviceName == null) {
            for (AudioDeviceInfo d : devices) {
                int type = d.getType();
                if (type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
                    || type == AudioDeviceInfo.TYPE_WIRED_HEADSET
                    || type == AudioDeviceInfo.TYPE_USB_HEADSET) {
                    deviceName = "Headphones";
                    break;
                }
            }
        }

        // Default to device model name
        if (deviceName == null) {
            deviceName = Build.MODEL; // e.g., "Pixel 8"
        }

        call.resolve(new JSObject().put("name", deviceName));
    }

    @Override
    protected void handleOnDestroy() {
        JellifyPlayerService.setStateChangeListener(null);
        releaseMediaController();
        Intent intent = new Intent(getContext(), JellifyPlayerService.class);
        getContext().stopService(intent);
        super.handleOnDestroy();
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        PermissionState foreground = getPermissionState("foreground_service");
        if (foreground == PermissionState.GRANTED) {
            call.resolve();
        } else {
            call.reject("Required permissions not granted");
        }
    }

    // ── helpers ───────────────────────────────────────────

    private void runOnService(PluginCall call, ServiceCallback callback) {
        if (!hasRequiredPermissions()) {
            call.reject("FOREGROUND_SERVICE permission not granted. Call requestPermissions() first.");
            return;
        }

        JellifyPlayerService service = JellifyPlayerService.getInstance();
        if (service != null) {
            ensureMediaController();
            new Handler(Looper.getMainLooper()).post(() -> {
                try {
                    callback.run(service);
                } catch (Exception e) {
                    Log.e(TAG, "Error handling " + call.getMethodName(), e);
                    call.reject("Plugin error", e);
                }
            });
            return;
        }

        Intent intent = new Intent(getContext(), JellifyPlayerService.class);
        getContext().startForegroundService(intent);

        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            int attempts = 0;
            @Override
            public void run() {
                JellifyPlayerService svc = JellifyPlayerService.getInstance();
                if (svc != null) {
                    ensureMediaController();
                    try {
                        callback.run(svc);
                    } catch (Exception e) {
                        Log.e(TAG, "Error handling " + call.getMethodName(), e);
                        call.reject("Plugin error", e);
                    }
                } else if (attempts < 5) {
                    attempts++;
                    new Handler(Looper.getMainLooper()).postDelayed(this, 200);
                } else {
                    call.reject("Player service failed to start");
                }
            }
        }, 200);
    }

    /** Connect a MediaController to the service so Media3 shows the notification. */
    private void ensureMediaController() {
        if (mediaController != null || mediaControllerFuture != null) return;

        new Handler(Looper.getMainLooper()).post(() -> {
            SessionToken sessionToken = new SessionToken(
                getContext(),
                new ComponentName(getContext(), JellifyPlayerService.class)
            );
            mediaControllerFuture = new MediaController.Builder(getContext(), sessionToken)
                .buildAsync();
            mediaControllerFuture.addListener(
                () -> {
                    try {
                        mediaController = mediaControllerFuture.get();
                        Log.i(TAG, "MediaController connected — notification should appear");
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to connect MediaController", e);
                        mediaControllerFuture = null;
                    }
                },
                MoreExecutors.directExecutor()
            );
        });
    }

    private void releaseMediaController() {
        if (mediaController != null) {
            mediaController.stop();
            mediaController.release();
            if (mediaControllerFuture != null) {
                MediaController.releaseFuture(mediaControllerFuture);
            }
            mediaController = null;
            mediaControllerFuture = null;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        Context ctx = getContext();
        if (ctx == null) return;
        NotificationManager manager = ctx.getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (manager.getNotificationChannel(JellifyPlayerService.PLAYBACK_CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            JellifyPlayerService.PLAYBACK_CHANNEL_ID,
            "Playback",
            NotificationManager.IMPORTANCE_LOW
        );
        manager.createNotificationChannel(channel);
    }

    private interface ServiceCallback {
        void run(JellifyPlayerService service) throws Exception;
    }
}
