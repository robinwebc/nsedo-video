package app.nsedo.video;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.ReturnCode;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;

@CapacitorPlugin(name = "NsedoFfmpeg")
public class NsedoFfmpegPlugin extends Plugin {
    private File dir() {
        File folder = new File(getContext().getCacheDir(), "nsedo");
        if (!folder.exists()) {
            folder.mkdirs();
        }
        return folder;
    }

    private File file(String name) throws Exception {
        if (name == null || name.isEmpty() || name.contains("..") || name.contains("/") || name.contains("\\")) {
            throw new Exception("bad filename");
        }
        return new File(dir(), name);
    }

    @PluginMethod
    public void put(PluginCall call) {
        try {
            String data = call.getString("data", "");
            boolean append = Boolean.TRUE.equals(call.getBoolean("append", false));
            byte[] bytes = data == null || data.isEmpty() ? new byte[0] : Base64.decode(data, Base64.DEFAULT);
            File target = file(call.getString("name"));
            try (FileOutputStream out = new FileOutputStream(target, append)) {
                out.write(bytes);
            }
            JSObject ret = new JSObject();
            ret.put("path", target.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void path(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            ret.put("path", file(call.getString("name")).getAbsolutePath());
            call.resolve(ret);
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void read(PluginCall call) {
        try {
            File target = file(call.getString("name"));
            int offset = call.getInt("offset", 0);
            int length = call.getInt("length", 0);
            long size = target.exists() ? target.length() : 0;
            byte[] bytes = new byte[0];
            if (length > 0 && target.exists() && offset >= 0 && offset < size) {
                int count = (int) Math.min(length, size - offset);
                bytes = new byte[count];
                try (RandomAccessFile raf = new RandomAccessFile(target, "r")) {
                    raf.seek(offset);
                    raf.readFully(bytes);
                }
            }
            JSObject ret = new JSObject();
            ret.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
            ret.put("size", size);
            call.resolve(ret);
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        try {
            File target = file(call.getString("name"));
            if (target.exists() && !target.delete()) {
                call.reject("delete failed");
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void run(PluginCall call) {
        try {
            JSArray values = call.getArray("args");
            if (values == null) {
                call.reject("missing args");
                return;
            }
            String[] args = new String[values.length()];
            for (int index = 0; index < values.length(); index++) {
                args[index] = values.getString(index);
            }
            FFmpegKit.executeWithArgumentsAsync(args, session -> {
                JSObject ret = new JSObject();
                ReturnCode code = session.getReturnCode();
                ret.put("code", code == null ? 1 : code.getValue());
                String logs = session.getAllLogsAsString();
                ret.put("log", logs == null ? "" : logs);
                call.resolve(ret);
            });
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void encoders(PluginCall call) {
        FFmpegKit.executeWithArgumentsAsync(new String[] { "-hide_banner", "-encoders" }, session -> {
            JSObject ret = new JSObject();
            String logs = session.getAllLogsAsString();
            ret.put("log", logs == null ? "" : logs);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void saveVideo(PluginCall call) {
        try {
            File source = file(call.getString("name"));
            String display = call.getString("displayName", "nSedo-Video.mp4");
            if (display == null || display.isEmpty()) display = "nSedo-Video.mp4";
            display = display.replaceAll("[\\\\/]", "-");
            String uri;
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Video.Media.DISPLAY_NAME, display);
                values.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
                values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/nSedo");
                values.put(MediaStore.Video.Media.IS_PENDING, 1);
                Uri item = getContext().getContentResolver().insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values);
                if (item == null) {
                    call.reject("gallery insert failed");
                    return;
                }
                try (OutputStream out = getContext().getContentResolver().openOutputStream(item); InputStream in = new FileInputStream(source)) {
                    copy(in, out);
                }
                values.clear();
                values.put(MediaStore.Video.Media.IS_PENDING, 0);
                getContext().getContentResolver().update(item, values, null, null);
                uri = item.toString();
            } else {
                File movies = getContext().getExternalFilesDir(Environment.DIRECTORY_MOVIES);
                if (movies != null && !movies.exists()) movies.mkdirs();
                File dest = new File(movies, display);
                try (OutputStream out = new FileOutputStream(dest); InputStream in = new FileInputStream(source)) {
                    copy(in, out);
                }
                uri = dest.getAbsolutePath();
            }
            JSObject ret = new JSObject();
            ret.put("uri", uri);
            call.resolve(ret);
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    private static void copy(InputStream in, OutputStream out) throws Exception {
        byte[] buffer = new byte[8192];
        int count;
        while ((count = in.read(buffer)) > 0) {
            out.write(buffer, 0, count);
        }
    }
}
