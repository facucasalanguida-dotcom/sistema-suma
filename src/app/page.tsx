import { Workbench } from '@/components/Workbench';
import { isGeminiConfigured } from '@/lib/gemini/client';

/**
 * El estado de la clave de Gemini se resuelve en el servidor y baja al cliente
 * como un simple booleano: así la interfaz puede avisar del modo demostración
 * sin exponer nunca la clave al navegador.
 */
export default function Home() {
  return <Workbench aiEnabled={isGeminiConfigured()} />;
}
