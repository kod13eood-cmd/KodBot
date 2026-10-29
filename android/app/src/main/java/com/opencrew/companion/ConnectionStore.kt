package com.opencrew.companion

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** The bearer token is encrypted with a device-local Android Keystore key. */
class ConnectionStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(STORE, Context.MODE_PRIVATE)

    fun load(): CompanionConnection? {
        val baseUrl = preferences.getString(KEY_BASE_URL, null) ?: return null
        val serverName = preferences.getString(KEY_SERVER_NAME, baseUrl) ?: baseUrl
        val iv = preferences.getString(KEY_TOKEN_IV, null)?.let { Base64.decode(it, Base64.NO_WRAP) }
            ?: return null
        val encrypted = preferences.getString(KEY_TOKEN, null)?.let { Base64.decode(it, Base64.NO_WRAP) }
            ?: return null
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
        val token = String(cipher.doFinal(encrypted), Charsets.UTF_8)
        return CompanionConnection(baseUrl, serverName, token)
    }

    fun save(connection: CompanionConnection) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.doFinal(connection.token.toByteArray(Charsets.UTF_8))
        preferences.edit()
            .putString(KEY_BASE_URL, connection.baseUrl)
            .putString(KEY_SERVER_NAME, connection.serverName)
            .putString(KEY_TOKEN_IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putString(KEY_TOKEN, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .apply()
    }

    fun clear() {
        preferences.edit().clear().apply()
        runCatching {
            val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
            keyStore.deleteEntry(KEY_ALIAS)
        }
    }

    fun cursor(): String? = preferences.getString(KEY_CURSOR, null)

    fun saveCursor(cursor: String) {
        preferences.edit().putString(KEY_CURSOR, cursor).apply()
    }

    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return generator.generateKey()
    }

    private companion object {
        const val STORE = "opencrew.companion"
        const val KEY_ALIAS = "opencrew.companion.device-token"
        const val KEY_BASE_URL = "baseUrl"
        const val KEY_SERVER_NAME = "serverName"
        const val KEY_TOKEN_IV = "tokenIv"
        const val KEY_TOKEN = "tokenCiphertext"
        const val KEY_CURSOR = "streamCursor"
        const val ANDROID_KEY_STORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
