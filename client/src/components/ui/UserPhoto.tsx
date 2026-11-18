import { useEffect, useState } from 'react';
import { api } from '../../api';
import { AvatarPortrait } from './AvatarPortrait';

interface PhotoOwner {
  id: string;
  username: string;
  photoUpdatedAt?: string | null;
}

/** URL de la foto del usuario (o null mientras carga / si no tiene). */
export function usePhotoUrl(user: PhotoOwner): string | null {
  const version = user.photoUpdatedAt ?? null;
  const [url, setUrl] = useState<{ key: string; src: string | null } | null>(null);
  const key = version ? `${user.id}:${version}` : null;

  useEffect(() => {
    if (!key || !version) return;
    let cancelled = false;
    api
      .getPhotoUrl(user.id, version)
      .then((src) => !cancelled && setUrl({ key, src }))
      .catch(() => !cancelled && setUrl({ key, src: null }));
    return () => {
      cancelled = true;
    };
  }, [key, user.id, version]);

  return key && url?.key === key ? url.src : null;
}

/**
 * Foto del pasaporte del usuario. Sin foto (o mientras carga) se ve el retrato dibujado,
 * que es estable para cada usuario.
 */
export function UserPhoto({
  user,
  className = '',
  shape = 'portrait',
}: {
  user: PhotoOwner;
  className?: string;
  /** portrait: proporcion de foto de pasaporte (la del retrato dibujado). square: miniaturas. */
  shape?: 'portrait' | 'square';
}) {
  const src = usePhotoUrl(user);
  if (!src) return <AvatarPortrait seed={user.username} className={className} />;
  const aspect = shape === 'portrait' ? 'aspect-[100/124]' : 'aspect-square';
  return <img src={src} alt={`Foto de ${user.username}`} className={`${aspect} object-cover ${className}`} />;
}
