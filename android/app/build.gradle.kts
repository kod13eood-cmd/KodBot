plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.kodbot.companion"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.kodbot.companion"
        minSdk = 26
        targetSdk = 35
        versionCode = 15
        versionName = "0.1.14"
    }

    buildFeatures {
        compose = true
    }

    signingConfigs {
        // CI can inject a stable keystore so every APK is signed by the same
        // key. Without it, local builds keep using the default debug key.
        getByName("debug") {
            val stableKeystore = System.getenv("KODBOT_ANDROID_KEYSTORE")
            if (!stableKeystore.isNullOrBlank()) {
                storeFile = file(stableKeystore)
                storePassword = System.getenv("KODBOT_ANDROID_KEYSTORE_PASSWORD") ?: "android"
                keyAlias = System.getenv("KODBOT_ANDROID_KEY_ALIAS") ?: "androiddebugkey"
                keyPassword = System.getenv("KODBOT_ANDROID_KEY_PASSWORD") ?: "android"
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.03.00")
    implementation(composeBom)
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
}
