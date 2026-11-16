package com.shougankedu.codm;
import android.app.Activity;
import android.os.Bundle;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.WindowManager;
import java.io.InputStream;
import java.io.ByteArrayInputStream;

public class MainActivity extends Activity {
 private WebView web;
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  getWindow().setStatusBarColor(0xff171d15);
  getWindow().setNavigationBarColor(0xff171d15);
  web = new WebView(this);
  web.setBackgroundColor(0xff171d15);
  web.getSettings().setJavaScriptEnabled(true);
  web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setAllowFileAccess(false);
  web.getSettings().setAllowContentAccess(false);
  web.getSettings().setSupportMultipleWindows(false);
  web.addJavascriptInterface(new ClipboardBridge(), "NativeClipboard");
  web.setWebViewClient(new WebViewClient() {
   @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
   @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
    String url = request.getUrl().toString();
    if (url.equals("https://appassets.local/index.html")) {
     try { InputStream in = getAssets().open("index.html"); return new WebResourceResponse("text/html", "UTF-8", in); }
     catch (Exception e) { return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0])); }
    }
    return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
   }
  });
  setContentView(web);
  web.loadUrl("https://appassets.local/index.html");
 }
 final class ClipboardBridge {
  @JavascriptInterface public boolean copy(String value) {
   try { ClipboardManager clipboard = (ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE); clipboard.setPrimaryClip(ClipData.newPlainText("灵敏度", value)); return true; }
   catch (Exception e) { return false; }
  }
 }
 @Override public void onBackPressed() { if(web.canGoBack()) web.goBack(); else super.onBackPressed(); }
 @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
