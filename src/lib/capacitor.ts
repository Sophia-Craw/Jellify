export function isCapacitor(): boolean {
  return typeof window !== "undefined" && typeof (window as any).Capacitor !== "undefined";
}

export async function setupStatusBar() {
  if (!isCapacitor()) return;
  try {
    const { SystemBars, SystemBarsStyle } = await import("@capacitor/core");
    await SystemBars.setStyle({ style: SystemBarsStyle.Dark });
  } catch {
    // SystemBars not available
  }
}

export async function setupKeepAwake() {
  if (!isCapacitor()) return;
  try {
    const { KeepAwake } = await import("@capacitor-community/keep-awake");
    (window as any).__keepAwake = KeepAwake;
  } catch {
    // KeepAwake plugin not available
  }
}

export async function setupWebviewGuardian() {
  if (!isCapacitor()) return;
  try {
    const { WebviewGuardian } = await import("@capgo/capacitor-webview-guardian");
    await WebviewGuardian.startMonitoring({
      autoRestart: true,
      restartStrategy: "reload",
    });
  } catch {
    // WebviewGuardian plugin not available
  }
}
