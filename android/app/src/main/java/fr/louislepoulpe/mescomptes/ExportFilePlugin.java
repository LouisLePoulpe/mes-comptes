package fr.louislepoulpe.mescomptes;

import android.app.Activity;
import android.content.Intent;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/** Android's document picker gives the user control over the destination.
 * No broad storage permission or filesystem path supplied by JavaScript is used. */
@CapacitorPlugin(name = "ExportFile")
public class ExportFilePlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.length() > 30 * 1024 * 1024) {
            call.reject("Export vide ou trop volumineux");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        intent.putExtra(Intent.EXTRA_TITLE, "mes-comptes.xlsx");
        startActivityForResult(call, intent, "documentChosen");
    }

    @ActivityCallback
    private void documentChosen(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject response = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        try (OutputStream output = getContext().getContentResolver().openOutputStream(result.getData().getData())) {
            if (output == null) throw new IllegalStateException("Destination inaccessible");
            output.write(Base64.decode(call.getString("data"), Base64.DEFAULT));
            response.put("cancelled", false);
            call.resolve(response);
        } catch (Exception exception) {
            call.reject("Impossible d’enregistrer l’export", exception);
        }
    }
}
