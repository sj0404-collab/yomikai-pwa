plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.yomikai.web"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.yomikai.web"
        minSdk = 24
        targetSdk = 34
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = System.getenv("RELEASE_TAG")?.removePrefix("shell-v") ?: "1.0"
    }

    signingConfigs {
        create("shell") {
            storeFile = file("release.p12")
            storeType = "PKCS12"
            storePassword = System.getenv("KEY_STORE_PASSWORD") ?: "android"
            keyAlias = System.getenv("ALIAS") ?: "yomikaiweb"
            keyPassword = System.getenv("KEY_PASSWORD") ?: "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("shell")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    // сетевой стек совместимый с HttpSource оригинала
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jsoup:jsoup:1.22.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
    implementation("io.reactivex:rxjava:1.3.8")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("androidx.core:core-ktx:1.13.1")
}
