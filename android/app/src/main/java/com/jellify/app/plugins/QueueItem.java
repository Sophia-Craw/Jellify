package com.jellify.app.plugins;

import org.json.JSONException;
import org.json.JSONObject;

public class QueueItem {
    public String id;
    public String url;
    public String title;
    public String artist;
    public String album;
    public String artworkUrl;

    public static QueueItem fromJson(JSONObject json) throws JSONException {
        QueueItem item = new QueueItem();
        item.id = json.optString("id", "");
        item.url = json.optString("url", "");
        item.title = json.optString("title", "");
        item.artist = json.optString("artist", "");
        item.album = json.optString("album", "");
        item.artworkUrl = json.optString("artworkUrl", "");
        return item;
    }
}
