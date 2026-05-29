import {
  Haptics,
  ImpactStyle,
  NotificationType,
} from "@capacitor/haptics";

export const haptic = {
  light(): void {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },
  medium(): void {
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  },
  heavy(): void {
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  },
  success(): void {
    void Haptics.notification({ type: NotificationType.Success }).catch(
      () => {},
    );
  },
  warning(): void {
    void Haptics.notification({ type: NotificationType.Warning }).catch(
      () => {},
    );
  },
  error(): void {
    void Haptics.notification({ type: NotificationType.Error }).catch(
      () => {},
    );
  },
};
