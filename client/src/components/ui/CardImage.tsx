import { useState } from 'react';
import type { ImageCredit } from '@roampass/shared';

interface CardImageProps {
  src: string;
  alt: string;
  credit?: ImageCredit;
  className?: string;
  imgClassName?: string;
}

/** Imagen de carta con placeholder si falla la red y atribucion de licencia (CC BY/BY-SA). */
export function CardImage({ src, alt, credit, className = '', imgClassName = '' }: CardImageProps) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className={`relative overflow-hidden bg-passport-800/10 dark:bg-black/30 ${className}`}>
      {failed ? (
        <div className="grid h-full min-h-40 place-items-center p-6 text-center text-sm text-passport-500">
          📷 No se pudo cargar la imagen. Revisa la conexión.
        </div>
      ) : (
        <img src={src} alt={alt} onError={() => setFailed(true)} className={imgClassName} draggable={false} />
      )}
      {credit && !failed && (
        <figcaption className="absolute right-1 bottom-1 max-w-[90%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/90">
          <a href={credit.source} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            {credit.author ? `${credit.author} · ` : ''}
            {credit.license}
          </a>
        </figcaption>
      )}
    </figure>
  );
}
