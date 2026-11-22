// Vibracion al resolver una carta (docs/specs/mobile-app.md, E5). En la web no hace nada.

import { useEffect } from 'react';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { isNative } from './index';

/**
 * Vibra una vez cuando aparece un resultado: corta y suave si suma millas, doble si resta.
 * `positive` en null = no hay resultado a la vista; vuelve a vibrar con el proximo.
 */
export function useResultHaptic(positive: boolean | null) {
  useEffect(() => {
    if (positive === null || !isNative()) return;
    void Haptics.notification({ type: positive ? NotificationType.Success : NotificationType.Error }).catch(() => {});
  }, [positive]);
}
