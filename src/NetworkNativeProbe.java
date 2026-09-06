// SPDX-License-Identifier: GPL-3.0-only

/** Offline JNI-load check in a disposable ARM32 process, never in system_server. */
public final class NetworkNativeProbe {
 public static void main(String[] args) throws Exception {
  String arch=System.getProperty("os.arch", "");
  if(!arch.startsWith("arm")||arch.contains("64"))throw new IllegalStateException("ARM32 required: "+arch);
  Class.forName("android.net.http.HttpEngine");
  // Invoke the donor's own boot-class loader so Android uses the correct APEX
  // linker namespace, rather than the command-line tool's app namespace.
  Class<?> loader=Class.forName("android.net.connectivity.org.chromium.net.impl.CronetLibraryLoader");
  java.lang.reflect.Method preload=loader.getDeclaredMethod("preload");
  preload.setAccessible(true);preload.invoke(null);
  System.out.println("NETWORK_JNI_LOAD_OK");
 }
}
