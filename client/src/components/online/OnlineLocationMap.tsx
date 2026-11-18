import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import type { LatLng } from '@roampass/shared';
import { FixSizeAndFit, GUESS_ICON, PickOnClick, TARGET_ICON } from '../game/LocationCardModal';

/**
 * Mapa de la carta LUGAR en partidas online. El jugador activo marca un punto; al resolverse, todos
 * ven el punto real y el elegido (5.4). Se carga aparte porque Leaflet pesa.
 */
export default function OnlineLocationMap(props: { canPick: boolean; guess: LatLng | null; target?: LatLng; onPick: (p: LatLng) => void }) {
  const { canPick, guess, target, onPick } = props;
  return (
    <MapContainer center={[20, 0]} zoom={2} minZoom={1} worldCopyJump className="absolute inset-0 z-0" attributionControl>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      <PickOnClick enabled={canPick} onPick={onPick} />
      {target && <FixSizeAndFit from={guess ?? target} to={target} />}
      {guess && <Marker position={guess} icon={GUESS_ICON} />}
      {target && (
        <>
          <Marker position={target} icon={TARGET_ICON} />
          {guess && <Polyline positions={[guess, target]} pathOptions={{ color: '#b42318', dashArray: '8 8', weight: 3 }} />}
        </>
      )}
    </MapContainer>
  );
}
