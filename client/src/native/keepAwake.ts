// Pantalla siempre encendida durante la partida (docs/specs/mobile-app.md, E5). En la web no hace nada.

import { useEffect } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNative } from './index';

/** Mientras el componente esta montado (y `active`), el celular no apaga la pantalla. */
export function useKeepAwake(active = true) {
  useEffect(() => {
    if (!active || !isNative()) return;
    void KeepAwake.keepAwake().catch(() => {});
    return () => void KeepAwake.allowSleep().catch(() => {});
  }, [active]);
}
