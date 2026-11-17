import { useNavigate } from 'react-router-dom';
import { RulesGuide } from './RulesGuide';

/** Pantalla "Cómo jugar" (se abre desde el panel). */
export function RulesPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl">📖 Cómo jugar</h1>
        <button className="btn-ghost min-h-12 px-4 text-sm" onClick={() => navigate('/')}>
          ← Volver al panel
        </button>
      </div>
      <div className="panel p-4 md:p-6">
        <RulesGuide onFinish={() => navigate('/')} />
      </div>
    </div>
  );
}
