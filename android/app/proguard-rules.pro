# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /sdk/tools/proguard/proguard-android.txt

# Keep JNI native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep Artemis JNI bridge classes
-keep class com.artemis.pfs.** { *; }
