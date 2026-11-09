package com.kodbot.companion

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Message
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView

/** Full-screen web UI with the native notification service still running.
 * The gateway session, when present, is installed as an HttpOnly cookie so the
 * WebView never receives the bearer token as a JavaScript-visible value. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebDesktopScreen(connection: CompanionConnection, onExit: () -> Unit) {
    val context = LocalContext.current
    val url = remember(connection.baseUrl, connection.kind) {
        DesktopMode.webUrl(connection.baseUrl, connection.kind)
    }
    val cookie = remember(connection.baseUrl, connection.token, connection.kind) {
        DesktopMode.sessionCookie(connection.baseUrl, connection.token, connection.kind)
    }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var fileCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = fileCallback
        fileCallback = null
        callback?.onReceiveValue(
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data),
        )
    }

    BackHandler {
        val view = webView
        if (view?.canGoBack() == true) view.goBack() else onExit()
    }

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
            CookieManager.getInstance().apply {
                cookie?.let { setCookie(connection.baseUrl, it) }
                flush()
            }
            WebView(ctx).apply {
                setBackgroundColor(0xFF101312.toInt())
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.allowFileAccess = false
                settings.allowContentAccess = true
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                settings.mediaPlaybackRequiresUserGesture = false
                settings.setSupportMultipleWindows(true)
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        view: WebView,
                        request: android.webkit.WebResourceRequest,
                    ): Boolean {
                        val target = request.url
                        if (DesktopMode.isSameOrigin(url, target.toString())) return false
                        return openExternal(context, target)
                    }
                }
                webChromeClient = object : WebChromeClient() {
                    override fun onCreateWindow(
                        view: WebView?,
                        isDialog: Boolean,
                        isUserGesture: Boolean,
                        resultMsg: Message?,
                    ): Boolean {
                        val transport = resultMsg?.obj as? WebView.WebViewTransport ?: return false
                        val popup = WebView(context)
                        popup.webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(
                                view: WebView,
                                request: android.webkit.WebResourceRequest,
                            ): Boolean {
                                openExternal(context, request.url)
                                view.destroy()
                                return true
                            }
                        }
                        transport.webView = popup
                        resultMsg.sendToTarget()
                        return true
                    }

                    override fun onShowFileChooser(
                        webView: WebView?,
                        filePathCallback: ValueCallback<Array<Uri>>?,
                        fileChooserParams: FileChooserParams?,
                    ): Boolean {
                        fileCallback?.onReceiveValue(null)
                        fileCallback = filePathCallback
                        val intent = fileChooserParams?.createIntent()
                            ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                                addCategory(Intent.CATEGORY_OPENABLE)
                                type = "*/*"
                                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                            }
                        return try {
                            filePicker.launch(intent)
                            true
                        } catch (_: Exception) {
                            fileCallback = null
                            false
                        }
                    }
                }
                loadUrl(url)
            }.also { webView = it }
        },
        update = { webView = it },
    )

    DisposableEffect(Unit) {
        onDispose {
            webView?.stopLoading()
            webView?.destroy()
            webView = null
        }
    }
}

private fun openExternal(context: Context, uri: Uri): Boolean {
    val intent = Intent(Intent.ACTION_VIEW, uri)
    return try {
        context.startActivity(intent)
        true
    } catch (_: Exception) {
        false
    }
}
