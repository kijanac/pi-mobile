import {
  Haptics,
  ImpactStyle,
  NotificationType,
} from "@capacitor/haptics";

/**
 * Tiny fire-and-forget wrapper around @capacitor/haptics.
 *
 * The plugin's web shim is no-throw (uses navigator.vibrate, which is
 * also a no-op when not user-initiated or on unsupported browsers) so
 * we don't need a platform guard. We do wrap every call in catch{}
 * because haptics are never critical and a failure shouldn't even
 * surface as a warning.
 *
 * Call sites use this instead of importing Haptics directly so that
 * (a) the API is one-character-shorter at call sites, (b) when we
 * later add a "disable haptics" toggle we change one file.
 */
export const haptic = {
  /** Light tap — the default for routine UI confirmations (send, etc). */
  light(): void {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },
  /** Medium thunk — for crossing a threshold (long-press fires). */
  medium(): void {
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  },
  /** Heavy — reserved for destructive confirmations. */
  heavy(): void {
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  },
  /** Quick success buzz — permission granted, task done, etc. */
  success(): void {
    void Haptics.notification({ type: NotificationType.Success }).catch(
      () => {},
    );
  },
  /** Warning buzz. Use for soft-failure cases the user may retry. */
  warning(): void {
    void Haptics.notification({ type: NotificationType.Warning }).catch(
      () => {},
    );
  },
  /** Error buzz — for unrecoverable failures the user must acknowledge. */
  error(): void {
    void Haptics.notification({ type: NotificationType.Error }).catch(
      () => {},
    );
  },
};
