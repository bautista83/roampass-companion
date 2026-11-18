import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { api, type User } from '../../api';
import { PhotoError, resizePhoto } from '../../lib/photo';
import { useAuthStore } from '../../store/authStore';

const message = (e: unknown) =>
  e instanceof PhotoError || e instanceof Error ? e.message : 'No se pudo guardar la foto.';

/**
 * Foto del pasaporte: sacarla con la camara (en el celular abre la frontal) o elegir una imagen.
 * Se achica en el navegador, se muestra una vista previa y recien al confirmar se sube.
 */
export function PhotoSection({ user }: { user: User }) {
  const setUser = useAuthStore((s) => s.setUser);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Libera la URL temporal de la vista previa.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite elegir el mismo archivo otra vez
    if (!file) return;
    setStatus(null);
    try {
      const blob = await resizePhoto(file);
      setPreview({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      setStatus({ ok: false, text: message(err) });
    }
  }

  async function run(action: () => Promise<User>, done: string) {
    setBusy(true);
    setStatus(null);
    try {
      setUser(await action());
      setPreview(null);
      setStatus({ ok: true, text: done });
    } catch (err) {
      setStatus({ ok: false, text: message(err) });
    } finally {
      setBusy(false);
    }
  }

  const statusClass = (ok: boolean) =>
    `rounded-xl border-2 border-ink px-3 py-2 text-sm font-bold text-ink ${ok ? 'bg-mint' : 'bg-coral'}`;

  return (
    <section className="panel space-y-4 p-4 md:p-6" aria-labelledby="foto">
      <div>
        <h2 id="foto" className="text-xl">
          Foto del pasaporte
        </h2>
        <p className="text-sm text-passport-500 dark:text-passport-300">
          Sácate una foto o elige una imagen. La recortamos y la achicamos para que quede bien.
        </p>
      </div>

      {preview ? (
        <div className="flex flex-wrap items-center gap-4">
          <img
            src={preview.url}
            alt="Vista previa de tu nueva foto"
            className="aspect-[100/124] w-28 border-3 border-ink object-cover shadow-[4px_4px_0_0_#111111]"
          />
          <div className="flex flex-1 flex-wrap gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => run(() => api.uploadPhoto(preview.blob), 'Foto guardada ✓')}>
              {busy ? 'Guardando…' : 'Guardar foto'}
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => setPreview(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => cameraInput.current?.click()}>
            📸 Sacar foto
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => fileInput.current?.click()}>
            🖼️ Elegir imagen
          </button>
          {user.photoUpdatedAt && (
            <button
              className="btn-ghost text-stamp"
              disabled={busy}
              onClick={() => run(() => api.deleteMyPhoto(), 'Foto quitada ✓')}
            >
              Quitar foto
            </button>
          )}
        </div>
      )}

      {/* capture="user": en el celular abre directamente la camara frontal; en la compu, el selector. */}
      <input ref={cameraInput} type="file" accept="image/*" capture="user" className="hidden" onChange={onPick} />
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onPick} />

      {status && (
        <p role="status" className={statusClass(status.ok)}>
          {status.text}
        </p>
      )}
    </section>
  );
}
