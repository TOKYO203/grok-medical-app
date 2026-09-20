const LAST_NOTIF_KEY = "optimus.lastNotifDay";
const REMINDER_HOUR = 20;

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | null {
  if (!isNotificationSupported()) return null;
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!isNotificationSupported()) return null;
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return null;
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function alreadyNotifiedToday(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(LAST_NOTIF_KEY) === todayKey();
}

export function markNotifiedToday(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_NOTIF_KEY, todayKey());
}

export function shouldRemind(answered: number, target: number): boolean {
  if (target <= 0) return false;
  if (answered >= target) return false;
  if (new Date().getHours() < REMINDER_HOUR) return false;
  if (alreadyNotifiedToday()) return false;
  return getNotificationPermission() === "granted";
}

export function sendDailyReminder(answered: number, target: number): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const remaining = Math.max(0, target - answered);
  try {
    new Notification("🎯 Optimus — Objectif du jour", {
      body: `Il te reste ${remaining} QCM${remaining > 1 ? "s" : ""} pour atteindre ton objectif. Encore un effort !`,
      icon: "/__grok/icon-192.png",
      tag: "optimus-daily",
    });
    markNotifiedToday();
    return true;
  } catch {
    return false;
  }
}
