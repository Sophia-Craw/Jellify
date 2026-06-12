package com.jellify.app.plugins;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import com.jellify.app.R;
import java.util.ArrayList;
import java.util.List;

public class JellifyPlayerService extends MediaSessionService {

    private static final String TAG = "JellifyPlayerService";
    public static final String PLAYBACK_CHANNEL_ID = "jellify_playback";
    private static final int NOTIFICATION_ID = 8012;

    public static class PlayerState {
        public final boolean isPlaying;
        public final int currentIndex;
        public final int queueSize;
        public final int repeatMode;
        public PlayerState(boolean isPlaying, int currentIndex, int queueSize, int repeatMode) {
            this.isPlaying = isPlaying;
            this.currentIndex = currentIndex;
            this.queueSize = queueSize;
            this.repeatMode = repeatMode;
        }
    }

    public interface StateChangeListener {
        void onStateChanged(PlayerState state);
    }
    private static StateChangeListener stateChangeListener;
    public static void setStateChangeListener(StateChangeListener listener) {
        stateChangeListener = listener;
    }

    public static final String ACTION_PLAY = "com.jellify.app.action.PLAY";
    public static final String ACTION_PAUSE = "com.jellify.app.action.PAUSE";
    public static final String ACTION_NEXT = "com.jellify.app.action.NEXT";
    public static final String ACTION_PREV = "com.jellify.app.action.PREV";

    private static JellifyPlayerService instance;

    private MediaSession mediaSession;
    private ExoPlayer exoPlayer;

    private final Handler bufferingTimeout = new Handler(Looper.getMainLooper());
    private Runnable bufferingRunnable;
    private static final int BUFFERING_TIMEOUT_MS = 15000;

    private PowerManager.WakeLock wakeLock;
    private long stallStartTime = -1;
    private static final long STALL_TIMEOUT_MS = 15000;

    private List<QueueItem> queue = new ArrayList<>();
    private int currentIndex = -1;
    public static final int REPEAT_OFF = 0;
    public static final int REPEAT_ALL = 1;
    public static final int REPEAT_ONE = 2;
    private int repeatMode = REPEAT_OFF;

    private List<MediaItem> buildMediaItems() {
        List<MediaItem> items = new ArrayList<>();
        for (QueueItem qi : queue) {
            items.add(buildMediaItem(qi));
        }
        return items;
    }

    private void syncExoPlayerQueue() {
        exoPlayer.setMediaItems(buildMediaItems(), currentIndex, C.TIME_UNSET);
        exoPlayer.prepare();
    }

    private static int appToExoRepeat(int mode) {
        switch (mode) {
            case REPEAT_ONE: return Player.REPEAT_MODE_ONE;
            case REPEAT_ALL: return Player.REPEAT_MODE_ALL;
            default:         return Player.REPEAT_MODE_OFF;
        }
    }

    private static int exoToAppRepeat(int mode) {
        switch (mode) {
            case Player.REPEAT_MODE_ONE: return REPEAT_ONE;
            case Player.REPEAT_MODE_ALL: return REPEAT_ALL;
            default:                     return REPEAT_OFF;
        }
    }

    public static JellifyPlayerService getInstance() {
        return instance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "JellifyPlayer::WakeLock");
            wakeLock.acquire();
        }

        createNotificationChannel();

        String packageName = getApplicationContext().getPackageName();
        Intent sessionActivityIntent = getPackageManager().getLaunchIntentForPackage(packageName);
        PendingIntent sessionActivityPendingIntent = PendingIntent.getActivity(
            getApplicationContext(), 0, sessionActivityIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        Notification initNotification = new NotificationCompat.Builder(this, PLAYBACK_CHANNEL_ID)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSmallIcon(R.drawable.ic_notification_music)
            .setContentTitle("Jellify")
            .setOngoing(true)
            .build();
        startForeground(NOTIFICATION_ID, initNotification);

        exoPlayer = new ExoPlayer.Builder(this)
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                true
            )
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build();
        exoPlayer.setPlayWhenReady(false);
        exoPlayer.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                int idx = exoPlayer.getCurrentMediaItemIndex();
                Log.i(TAG, "state: " + stateName(playbackState)
                    + " idx=" + idx
                    + " q=" + queue.size());

                if (playbackState == Player.STATE_BUFFERING) {
                    cancelBufferingTimeout();
                    bufferingRunnable = () -> {
                        Log.w(TAG, "Buffering timeout — skipping");
                        advanceToNext();
                    };
                    bufferingTimeout.postDelayed(bufferingRunnable, BUFFERING_TIMEOUT_MS);
                } else {
                    cancelBufferingTimeout();
                }

                fireStateChange();
            }

            @Override
            public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {
                currentIndex = exoPlayer.getCurrentMediaItemIndex();
                Log.i(TAG, "mediaItemTransition idx=" + currentIndex);
                updateNotification();
            }

            @Override
            public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
                Log.i(TAG, "playWhenReady=" + playWhenReady + " reason=" + reason);
                fireStateChange();
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                Log.i(TAG, "isPlaying=" + isPlaying + " playWhenReady=" + exoPlayer.getPlayWhenReady());
                if (exoPlayer.getPlayWhenReady() && !isPlaying) {
                    if (stallStartTime < 0) {
                        stallStartTime = System.currentTimeMillis();
                        Log.w(TAG, "Stall detected — starting stall timer");
                    } else if (System.currentTimeMillis() - stallStartTime > STALL_TIMEOUT_MS) {
                        Log.w(TAG, "Stall timeout (" + STALL_TIMEOUT_MS + "ms) — skipping track");
                        stallStartTime = -1;
                        advanceToNext();
                    }
                } else {
                    if (stallStartTime >= 0) {
                        Log.i(TAG, "Stall recovered");
                    }
                    stallStartTime = -1;
                }

                fireStateChange();
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                Log.e(TAG, "error code=" + error.errorCode + " msg=" + error.getMessage(), error);
                cancelBufferingTimeout();
                advanceToNext();
            }
        });

        mediaSession = new MediaSession.Builder(this, exoPlayer)
            .setCallback(new MediaSession.Callback() {
                @Override
                public MediaSession.ConnectionResult onConnect(
                    MediaSession session,
                    MediaSession.ControllerInfo controller
                ) {
                    Log.i(TAG, "MediaController connected: " + controller.getPackageName());
                    return new MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                        .setAvailableSessionCommands(
                            MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS
                        )
                        .build();
                }
            })
            .setSessionActivity(sessionActivityPendingIntent)
            .build();
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) {
            switch (intent.getAction()) {
                case ACTION_PLAY:
                    play();
                    break;
                case ACTION_PAUSE:
                    pause();
                    break;
                case ACTION_NEXT:
                    next();
                    break;
                case ACTION_PREV:
                    prev();
                    break;
            }
        }
        return super.onStartCommand(intent, flags, startId);
    }

    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        if (exoPlayer != null && exoPlayer.getPlayWhenReady()) {
            exoPlayer.pause();
        }
        stopSelf();
    }

    @Override
    public void onDestroy() {
        cancelBufferingTimeout();
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
        instance = null;
        if (exoPlayer != null) {
            exoPlayer.release();
            exoPlayer = null;
        }
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        queue.clear();
        currentIndex = -1;
        super.onDestroy();
    }

    // ── Queue management ──────────────────────────────────

    public void replaceQueue(List<QueueItem> items, int newIndex) {
        queue = new ArrayList<>(items);
        currentIndex = newIndex;
        syncExoPlayerQueue();
        if (exoPlayer.getPlayWhenReady()) {
            exoPlayer.play();
        }
        updateNotification();
    }

    public void setQueue(List<QueueItem> items, int startIndex) {
        queue = items;
        currentIndex = startIndex;
        syncExoPlayerQueue();
        exoPlayer.play();
        updateNotification();
    }

    public void addToQueue(List<QueueItem> items, int atIndex) {
        if (atIndex < 0 || atIndex > queue.size()) {
            queue.addAll(items);
        } else {
            queue.addAll(atIndex, items);
        }
        // Rebuild exoPlayer playlist
        boolean wasPlaying = exoPlayer.getPlayWhenReady();
        long pos = exoPlayer.getCurrentPosition();
        int curIdx = exoPlayer.getCurrentMediaItemIndex();
        exoPlayer.stop();
        syncExoPlayerQueue();
        exoPlayer.seekTo(curIdx, pos);
        if (wasPlaying) exoPlayer.play();
    }

    public void removeFromQueue(int index) {
        if (index < 0 || index >= queue.size()) return;
        queue.remove(index);
        boolean wasPlaying = exoPlayer.getPlayWhenReady();
        int curIdx = exoPlayer.getCurrentMediaItemIndex();
        long pos = exoPlayer.getCurrentPosition();
        int newCurIdx = curIdx;
        if (curIdx > index) {
            newCurIdx = curIdx - 1;
        } else if (curIdx == index) {
            if (queue.isEmpty()) {
                exoPlayer.stop();
                currentIndex = -1;
                updateNotification();
                return;
            }
            newCurIdx = Math.min(curIdx, queue.size() - 1);
        }
        exoPlayer.stop();
        syncExoPlayerQueue();
        exoPlayer.seekTo(newCurIdx, pos);
        currentIndex = newCurIdx;
        if (wasPlaying) exoPlayer.play();
        updateNotification();
    }

    public void reorderQueue(int fromIndex, int toIndex) {
        if (fromIndex < 0 || fromIndex >= queue.size()) return;
        if (toIndex < 0 || toIndex >= queue.size()) return;
        QueueItem item = queue.remove(fromIndex);
        queue.add(toIndex, item);
        boolean wasPlaying = exoPlayer.getPlayWhenReady();
        int curIdx = exoPlayer.getCurrentMediaItemIndex();
        long pos = exoPlayer.getCurrentPosition();
        int newCurIdx = curIdx;
        if (curIdx == fromIndex) {
            newCurIdx = toIndex;
        } else if (curIdx > fromIndex && curIdx <= toIndex) {
            newCurIdx = curIdx - 1;
        } else if (curIdx < fromIndex && curIdx >= toIndex) {
            newCurIdx = curIdx + 1;
        }
        exoPlayer.stop();
        syncExoPlayerQueue();
        exoPlayer.seekTo(newCurIdx, pos);
        currentIndex = newCurIdx;
        if (wasPlaying) exoPlayer.play();
        updateNotification();
    }

    // ── Playback controls ─────────────────────────────────

    public int getRepeatMode() {
        return repeatMode;
    }

    public void setRepeatMode(int mode) {
        this.repeatMode = mode;
        exoPlayer.setRepeatMode(appToExoRepeat(mode));
    }

    public int getQueueSize() {
        return queue.size();
    }

    public int getCurrentIndex() {
        return currentIndex = exoPlayer.getCurrentMediaItemIndex();
    }

    public boolean isPlaying() {
        return exoPlayer != null && exoPlayer.getPlayWhenReady();
    }

    public float getCurrentTimeSec() {
        if (exoPlayer == null) return 0;
        return exoPlayer.getCurrentPosition() / 1000f;
    }

    public float getDurationSec() {
        if (exoPlayer == null) return 0;
        long dur = exoPlayer.getDuration();
        return dur == C.TIME_UNSET ? -1 : dur / 1000f;
    }

    public void play() {
        if (exoPlayer == null) return;
        int state = exoPlayer.getPlaybackState();
        if (state == Player.STATE_ENDED) {
            exoPlayer.seekToDefaultPosition();
            exoPlayer.play();
        } else {
            exoPlayer.play();
        }
        updateNotification();
    }

    public void pause() {
        if (exoPlayer == null) return;
        exoPlayer.pause();
        updateNotification();
    }

    public void next() {
        if (exoPlayer.hasNextMediaItem()) {
            exoPlayer.seekToNextMediaItem();
        } else if (repeatMode == REPEAT_ALL && !queue.isEmpty()) {
            exoPlayer.seekToDefaultPosition(0);
            exoPlayer.play();
        }
        updateNotification();
    }

    public void prev() {
        if (exoPlayer.hasPreviousMediaItem()) {
            exoPlayer.seekToPreviousMediaItem();
        } else if (repeatMode == REPEAT_ALL && !queue.isEmpty()) {
            exoPlayer.seekToDefaultPosition(queue.size() - 1);
            exoPlayer.play();
        }
        updateNotification();
    }

    public void seekTo(long timeMs) {
        if (exoPlayer != null) exoPlayer.seekTo(timeMs);
    }

    public void setVolume(float volume) {
        if (exoPlayer != null) exoPlayer.setVolume(volume);
    }

    // ── Internal ──────────────────────────────────────────

    private void advanceToNext() {
        if (exoPlayer.hasNextMediaItem()) {
            exoPlayer.seekToNextMediaItem();
        } else if (repeatMode == REPEAT_ALL && !queue.isEmpty()) {
            exoPlayer.seekToDefaultPosition(0);
            exoPlayer.play();
        } else {
            exoPlayer.stop();
        }
        updateNotification();
    }

    private void advanceToPrev() {
        if (exoPlayer.hasPreviousMediaItem()) {
            exoPlayer.seekToPreviousMediaItem();
        } else if (repeatMode == REPEAT_ALL && !queue.isEmpty()) {
            exoPlayer.seekToDefaultPosition(queue.size() - 1);
            exoPlayer.play();
        } else {
            exoPlayer.seekToDefaultPosition();
            exoPlayer.play();
        }
        updateNotification();
    }

    private void fireStateChange() {
        if (stateChangeListener != null) {
            stateChangeListener.onStateChanged(
                new PlayerState(isPlaying(), getCurrentIndex(), queue.size(), repeatMode)
            );
        }
    }

    private void updateNotification() {
        startForeground(NOTIFICATION_ID, buildMediaStyleNotification());
        fireStateChange();
    }

    private Notification buildMediaStyleNotification() {
        String title = "Jellify";
        String artist = "";
        String album = "";

        MediaItem current = exoPlayer != null ? exoPlayer.getCurrentMediaItem() : null;
        if (current != null) {
            MediaMetadata meta = current.mediaMetadata;
            if (meta.title != null) title = meta.title.toString();
            if (meta.artist != null) artist = meta.artist.toString();
            if (meta.albumTitle != null) album = meta.albumTitle.toString();
        }

        String packageName = getApplicationContext().getPackageName();
        Intent contentIntent = getPackageManager().getLaunchIntentForPackage(packageName);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
            this, 0, contentIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;

        Intent prevIntent = new Intent(this, JellifyPlayerService.class).setAction(ACTION_PREV);
        PendingIntent prevPendingIntent = PendingIntent.getService(
            this, 1, prevIntent, flags
        );

        boolean playing = isPlaying();
        Intent toggleIntent = new Intent(this, JellifyPlayerService.class)
            .setAction(playing ? ACTION_PAUSE : ACTION_PLAY);
        PendingIntent togglePendingIntent = PendingIntent.getService(
            this, 2, toggleIntent, flags
        );

        Intent nextIntent = new Intent(this, JellifyPlayerService.class).setAction(ACTION_NEXT);
        PendingIntent nextPendingIntent = PendingIntent.getService(
            this, 3, nextIntent, flags
        );

        androidx.media.app.NotificationCompat.MediaStyle mediaStyle =
            new androidx.media.app.NotificationCompat.MediaStyle()
                .setShowActionsInCompactView(0, 1, 2);

        return new NotificationCompat.Builder(this, PLAYBACK_CHANNEL_ID)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSmallIcon(R.drawable.ic_notification_music)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText(album)
            .setContentIntent(contentPendingIntent)
            .setOngoing(true)
            .setStyle(mediaStyle)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevPendingIntent)
            .addAction(
                playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                playing ? "Pause" : "Play",
                togglePendingIntent
            )
            .addAction(android.R.drawable.ic_media_next, "Next", nextPendingIntent)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (manager.getNotificationChannel(PLAYBACK_CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            PLAYBACK_CHANNEL_ID,
            "Playback",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        manager.createNotificationChannel(channel);
    }

    private void cancelBufferingTimeout() {
        if (bufferingRunnable != null) {
            bufferingTimeout.removeCallbacks(bufferingRunnable);
            bufferingRunnable = null;
        }
    }

    private static String stateName(int state) {
        switch (state) {
            case Player.STATE_IDLE:      return "IDLE";
            case Player.STATE_BUFFERING: return "BUFFERING";
            case Player.STATE_READY:     return "READY";
            case Player.STATE_ENDED:     return "ENDED";
            default: return "UNKNOWN(" + state + ")";
        }
    }

    private MediaItem buildMediaItem(QueueItem item) {
        MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
            .setTitle(item.title != null ? item.title : "")
            .setArtist(item.artist != null ? item.artist : "")
            .setAlbumTitle(item.album != null ? item.album : "");
        if (item.artworkUrl != null && !item.artworkUrl.isEmpty()) {
            metaBuilder.setArtworkUri(Uri.parse(item.artworkUrl));
        }
        return new MediaItem.Builder()
            .setMediaId(item.id)
            .setMediaMetadata(metaBuilder.build())
            .setUri(item.url != null ? item.url : "")
            .build();
    }
}
