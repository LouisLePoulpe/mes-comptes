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
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;

/** Android's document picker gives the user control over the destination.
 * No broad storage permission or filesystem path supplied by JavaScript is used. */
@CapacitorPlugin(name = "ExportFile")
public class ExportFilePlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty() || data.length() > 30 * 1024 * 1024) {
            call.reject("Export vide ou trop volumineux", "EXPORT_DATA");
            return;
        }
        // Stage the bytes before opening the picker. Activity recreation must not
        // depend on carrying the entire base64 workbook through saved state.
        File pending;
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            if (bytes.length == 0) throw new IllegalArgumentException("Export vide");
            pending = File.createTempFile("pending-export-", ".xlsx", getContext().getCacheDir());
            try (OutputStream output = new FileOutputStream(pending)) { output.write(bytes); }
            call.getData().put("pendingExport", pending.getName());
            call.getData().remove("data");
        } catch (Exception exception) {
            call.reject("Préparation de l’export impossible", "EXPORT_PREPARE", exception);
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        intent.putExtra(Intent.EXTRA_TITLE, "mes-comptes.xlsx");
        try { startActivityForResult(call, intent, "documentChosen"); }
        catch (Exception exception) {
            pending.delete();
            call.reject("Sélecteur de fichiers indisponible", "EXPORT_PICKER", exception);
        }
    }

    @ActivityCallback
    private void documentChosen(PluginCall call, ActivityResult result) {
        if (call == null) return;
        // A document provider may block while opening or closing the destination.
        // Keep its I/O off the activity-result/UI thread.
        bridge.execute(() -> finishExport(call, result));
    }

    private void finishExport(PluginCall call, ActivityResult result) {
        String name = call.getString("pendingExport");
        if (name == null || !name.matches("pending-export-[a-zA-Z0-9-]+\\.xlsx")) {
            call.reject("Export interrompu. Relance l’enregistrement.", "EXPORT_INTERRUPTED");
            return;
        }
        File pending = new File(getContext().getCacheDir(), name);
        JSObject response = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            response.put("cancelled", true);
            pending.delete();
            call.resolve(response);
            return;
        }
        try {
            if (!pending.isFile() || pending.length() == 0) throw new IllegalStateException("Export temporaire absent");
            try (FileInputStream input = new FileInputStream(pending);
                 OutputStream output = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
                if (output == null) throw new IllegalStateException("Destination inaccessible");
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                output.flush();
            }
            // Report success only after the destination stream has closed.
            response.put("cancelled", false);
            call.resolve(response);
        } catch (Exception exception) {
            call.reject("Impossible d’enregistrer l’export", "EXPORT_WRITE", exception);
        } finally {
            pending.delete();
        }
    }
}
