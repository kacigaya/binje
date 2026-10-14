"use client";

import { WebHaptics } from "web-haptics";

type HapticInput = Parameters<WebHaptics["trigger"]>[0];

let instance: WebHaptics | null = null;

/**
 * Fires haptic feedback from a user gesture. One shared instance, because on
 * iOS each `WebHaptics` mounts its own hidden switch element to fake the
 * Vibration API. Call synchronously inside the event handler: iOS only
 * honours the switch toggle while the gesture is still active.
 */
export function haptic(input?: HapticInput) {
  if (typeof window === "undefined") return;
  instance ??= new WebHaptics();
  void instance.trigger(input);
}
