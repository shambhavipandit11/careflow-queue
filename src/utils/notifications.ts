// Notification utilities
class AudioNotifier {
  private audioContext: AudioContext | null = null;

  constructor() {
    if (typeof AudioContext !== "undefined" || typeof (window as any).webkitAudioContext !== "undefined") {
      this.audioContext = new (AudioContext || (window as any).webkitAudioContext)();
    }
  }

  play2ToneChime(): void {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // First tone: 800 Hz for 200ms
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.value = 800;
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Second tone: 1000 Hz for 200ms, starting after 300ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.value = 1000;
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    const startTime = now + 0.3;
    gain2.gain.setValueAtTime(0.3, startTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
    osc2.start(startTime);
    osc2.stop(startTime + 0.2);
  }
}

class BrowserNotifier {
  private hasPermission: boolean = false;

  async requestPermission(): Promise<void> {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      this.hasPermission = true;
      return;
    }
    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === "granted";
    }
  }

  show(title: string, body: string): void {
    if (!this.hasPermission) return;
    const notification = new Notification(title, {
      body,
      tag: "queueflow-notification"
    });
    setTimeout(() => notification.close(), 10000);
  }
}

export class NotificationManager {
  private audio = new AudioNotifier();
  private browser = new BrowserNotifier();
  private toastCallback: ((message: string) => void) | null = null;

  setToastCallback(callback: (message: string) => void): void {
    this.toastCallback = callback;
  }

  async requestPermission(): Promise<void> {
    await this.browser.requestPermission();
  }

  notifyApproaching(token: string, position: number): void {
    const message = `Token ${token}: You're approaching! Position ${position}`;
    this.audio.play2ToneChime();
    this.browser.show("Your Turn is Approaching", message);
    this.toastCallback?.(message);
  }

  notifyCalled(token: string): void {
    const message = `Token ${token}: Please proceed to service counter`;
    this.audio.play2ToneChime();
    this.browser.show("You're Being Called!", message);
    this.toastCallback?.(message);
  }
}
