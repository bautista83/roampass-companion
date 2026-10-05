import { useEffect, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { CATEGORY_META, LOCATION_BRACKETS, normalizeLng, type LatLng, type LocationCard, formatNumber } from '@roampass/shared';
import { useGameStore, type ActiveDraw } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { CardImage } from '../ui/CardImage';
import { CardResult } from './CardResult';

// divIcon evita el problema clasico de rutas de imagenes de Leaflet con bundlers.
const pin = (emoji: string, bg: string) =>
  L.divIcon({
    className: 'rp-pin',
    html: `<div style="display:grid;place-items:center;width:40px;height:40px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};box-shadow:0 4px 10px rgb(0 0 0/.4);border:3px solid white"><span style="transform:rotate(45deg);font-size:18px">${emoji}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
const GUESS_ICON = pin('🧭', '#233462');
const TARGET_ICON = pin('📍', '#157347');

function PickOnClick({ enabled, onPick }: { enabled: boolean; onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick({ lat: e.latlng.lat, lng: normalizeLng(e.latlng.lng) });
    },
  });
  return null;
}

/** El modal anima su tamaño: Leaflet necesita recalcular el contenedor al terminar. */
function FixSizeAndFit({ from, to }: { from: LatLng | null; to: LatLng }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 400);
    return () => clearTimeout(t);
  }, [map]);
  const [fLat, fLng] = [from?.lat, from?.lng];
  useEffect(() => {
    if (fLat === undefined || fLng === undefined) return;
    map.flyToBounds(L.latLngBounds([[fLat, fLng], to]).pad(0.35), { duration: 1.2, maxZoom: 8 });
  }, [map, fLat, fLng, to]);
  return null;
}

const formatKm = (km: number) => `${km < 10 ? km.toFixed(1) : formatNumber(Math.round(km))} km`;

/** LUGAR: foto panoramica + mapa Leaflet/OpenStreetMap; puntua por distancia Haversine. */
export function LocationCardModal({ draw }: { draw: ActiveDraw }) {
  const card = draw.card as LocationCard;
  const resolve = useGameStore((s) => s.resolve);
  const player = useGameStore((s) => s.game?.players.find((p) => p.id === draw.playerId));
  const resolved = draw.resolved;
  const [guess, setGuess] = useState<LatLng | null>(null);
  const shownGuess = resolved?.guess ?? guess;
  const meta = CATEGORY_META.LOCATION;

  return (
    <Modal
      open
      flip
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          <span>{meta.label}</span>
          <span className="truncate text-sm font-normal text-passport-500 dark:text-passport-300">
            · {player?.avatar} {player?.name}
          </span>
        </span>
      }
    >
      <div className="flex h-full flex-col md:grid md:h-[78dvh] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Panorama: se desplaza horizontalmente para "mirar alrededor" */}
        <div className="flex h-[30dvh] shrink-0 flex-col md:h-full">
          <CardImage
            src={card.imageUrl}
            alt="Lugar misterioso"
            credit={card.credit}
            className="min-h-0 flex-1 overflow-x-auto"
            imgClassName="h-full w-auto max-w-none md:h-full md:w-full md:object-cover"
          />
          <p className="hidden px-4 py-2 text-xs text-passport-500 md:block dark:text-passport-300">↔ {card.prompt}</p>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-[38dvh] flex-1">
            <MapContainer center={[20, 0]} zoom={2} minZoom={1} worldCopyJump className="absolute inset-0 z-0" attributionControl>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <PickOnClick enabled={!resolved} onPick={setGuess} />
              <FixSizeAndFit from={resolved?.guess ?? null} to={card.location} />
              {shownGuess && <Marker position={shownGuess} icon={GUESS_ICON} />}
              {resolved && (
                <>
                  <Marker position={card.location} icon={TARGET_ICON} />
                  {shownGuess && <Polyline positions={[shownGuess, card.location]} pathOptions={{ color: '#b42318', dashArray: '8 8', weight: 3 }} />}
                </>
              )}
            </MapContainer>
          </div>

          <div className="shrink-0 border-t border-passport-800/10 p-3 md:p-4 dark:border-white/10">
            {resolved && player ? (
              <CardResult result={resolved.result} playerName={player.name}>
                <p className="text-lg">
                  📍 <strong>{card.answerLabel}</strong>
                  <br />
                  Distancia: <strong className="tabular-nums">{formatKm(resolved.result.distanceKm ?? 0)}</strong>
                </p>
              </CardResult>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-passport-500 dark:text-passport-300">
                  {guess ? '¿Seguro? Puedes tocar otro punto para moverlo.' : '👆 Toca el mapa donde crees que se tomó la foto.'}
                  <span className="block text-xs">
                    ≤{LOCATION_BRACKETS[0].maxKm} km: {LOCATION_BRACKETS[0].points} · ≤{LOCATION_BRACKETS[1].maxKm} km: {LOCATION_BRACKETS[1].points} · ≤
                    {formatNumber(LOCATION_BRACKETS[2].maxKm)} km: {LOCATION_BRACKETS[2].points}
                  </span>
                </p>
                <button className="btn-primary shrink-0 text-lg" disabled={!guess} onClick={() => guess && resolve({ kind: 'LOCATION', card, guess })}>
                  Confirmar ubicación
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
