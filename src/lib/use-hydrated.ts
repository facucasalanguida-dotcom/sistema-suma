'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Indica si el componente ya se está ejecutando en el navegador.
 *
 * El presupuesto se guarda en `localStorage`, así que en el servidor siempre
 * está vacío y en el cliente puede tener partidas. Pintar directamente el
 * estado guardado provocaría un desajuste de hidratación, y usar un efecto
 * para marcarlo dispara un render en cascada. `useSyncExternalStore` resuelve
 * las dos cosas: devuelve `false` en el servidor y en el primer render del
 * cliente, y `true` a partir de ahí.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
