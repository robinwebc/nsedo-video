package app.nsedo.video;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NsedoFfmpegPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
