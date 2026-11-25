import { MuWindows } from '@/controllers/interface/windowManager';
import './style.less';
import { useLayoutEffect, useRef, useState } from 'react';
import { observable, runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { Ecs } from '@/ecs/current';
import { isMobileDevice } from '@/controllers/interface/mobile';
import { t } from '@/i18n';
import { GameOptions, uiScaleFactor } from '@/controllers/settings';
import type { MinimapMarker } from '@/controllers/terrain/minimapData';
import { MuTipText } from '@/controllers/interface/components/mu_text';
import {
  CenterButton,
  Frame,
  HERO_SIZE,
  HERO_SPRITE,
  isPanned,
  MARKER_SIZE,
  MARKER_SPRITE,
  NO_PAN,
  NPC_SIZE,
  NPC_SPRITE,
  Sprite,
  TERRAIN_SIZE,
  useMapDrag,
  useMapRotation,
  usePartyMarkers,
  useWorldMinimap,
  type MapPan,
} from './shared';
import { markerTurn } from './rotation';

/**
 * The corner minimap: ours. The original's one map is the TAB sheet
 * (`CNewUIMiniMap`, `sheet.tsx`); later clients keep a small copy of it in
 * the top right corner of the play area, and this is that - the same
 * `mini_map.ozt`, the same turn about the hero (`rotation.ts`), the same marker files,
 * drawn small and left on screen. TAB still opens the sheet, over it;
 * the panel steps aside while the sheet is up.
 *
 * Laid out in the sheet's art units (its 35 px corners, 15 / 30 px markers)
 * and scaled as one element, so the frame and the markers keep the sheet's
 * proportions at any interface size. The bar under it (the coordinates, and
 * the Center button while the map is dragged off the hero) is scaled back
 * up to the interface size, so its text and plate match every other button.
 *
 * The hero moves every frame and nothing here re-renders for it: the
 * markers and the hero are children of the map picture at their own tile,
 * and one frame loop slides the picture under the fixed centre and writes
 * the hero's place and the coordinates.
 */

const PANEL = 240;
/** Art units to CSS pixels at interface size 100%. */
const PANEL_SCALE = 0.75;

/**
 * Whether the corner map is folded away on a phone (user decision,
 * 2026-11-24): the panel becomes one small square, the map glyph on it.
 * Module state, not a window: the party list and the camera reset read the
 * span below and slide right while it is folded. Default open, desktop
 * never folds (the button only exists on a phone).
 */
export const minimapCornerCollapsed = observable.box(false);

/** The folded square's side, in screen pixels: a thumb target, unscaled. */
const MINI_SIZE = 40;

/** The panel's on-screen width with its 10 px margin, for the HUD pieces left of it (party list). */
export const cornerPanelSpan = (): number =>
  minimapCornerCollapsed.get()
    ? 10 + MINI_SIZE
    : 10 + PANEL * PANEL_SCALE * uiScaleFactor(GameOptions.uiScale);

/** Map edge length per zoom step, in art units; the sheet draws 800. */
const ZOOM_LEVELS = [512, 640, 768, 1024, 1280];
const DEFAULT_ZOOM = 2;

const MapMarker = ({
  marker,
  mapSize,
  rotation,
}: {
  marker: MinimapMarker;
  mapSize: number;
  rotation: number;
}) => {
  const [hovered, setHovered] = useState(false);
  const size = MARKER_SIZE[marker.kind] ?? NPC_SIZE;

  // Its tile on the picture: U along tile Y, V along tile X, as the sheet.
  // Upright again inside the spun picture; the sprite then turns by its own
  // yaw, which leaves the tip box upright too.
  return (
    <div
      className="minimap-corner-marker"
      style={{
        left: (marker.y / TERRAIN_SIZE) * mapSize - size / 2,
        top: (marker.x / TERRAIN_SIZE) * mapSize - size / 2,
        width: size,
        height: size,
        transform: `rotate(${-rotation}deg)`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Sprite
        file={MARKER_SPRITE[marker.kind] ?? NPC_SPRITE}
        size={size}
        style={{ transform: `rotate(${markerTurn(marker.rotation, rotation)}deg)` }}
      />
      {hovered && (
        <MuTipText
          text={marker.name}
          background="rgba(0,0,0,0.7)"
          className="minimap-corner-tip"
        />
      )}
    </div>
  );
};

export const MinimapCorner = observer(() => {
  const world = Ecs.world;
  // Under the sheet it would only be a dimmed ghost of the same map.
  const shown = !!world && !MuWindows.isOpen('minimap');
  // `mapIndex` is a plain field: the frame loop below carries a warp over.
  const [map, setMap] = useState<number | undefined>(undefined);
  const minimap = useWorldMinimap(shown ? map : undefined);
  const partyMarkers = usePartyMarkers(shown, map);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState<MapPan>(NO_PAN);
  const pictureRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const coordsRef = useRef<HTMLDivElement>(null);
  const scale = PANEL_SCALE * uiScaleFactor(GameOptions.uiScale);
  const mapSize = ZOOM_LEVELS[zoom];
  const rotation = useMapRotation(shown);
  const { dragging, handlers } = useMapDrag(mapSize, scale, rotation, setPan);

  // Before paint, so the picture never shows its top-left corner for a frame.
  useLayoutEffect(() => {
    if (!shown) return;

    let frame = 0;
    let lastMap = map;
    let lastX = NaN;
    let lastY = NaN;

    const tick = () => {
      frame = requestAnimationFrame(tick);

      const current = Ecs.world;
      if (!current) return;
      if (current.mapIndex !== lastMap) {
        lastMap = current.mapIndex;
        setMap(lastMap);
        // A warp: back on the hero.
        setPan(NO_PAN);
      }

      const pos = current.playerEntity?.transform?.pos;
      const picture = pictureRef.current;
      if (!pos || !picture || (pos.x === lastX && pos.z === lastY)) return;
      lastX = pos.x;
      lastY = pos.z;

      const heroTx = (pos.z / TERRAIN_SIZE) * mapSize;
      const heroTy = (pos.x / TERRAIN_SIZE) * mapSize;
      const tx = heroTx + (pan.u / TERRAIN_SIZE) * mapSize;
      const ty = heroTy + (pan.v / TERRAIN_SIZE) * mapSize;
      picture.style.transform = `translate(${-tx}px, ${-ty}px)`;
      const hero = heroRef.current;
      if (hero) {
        hero.style.left = `${heroTx - HERO_SIZE / 2}px`;
        hero.style.top = `${heroTy - HERO_SIZE / 2}px`;
      }
      if (coordsRef.current) {
        coordsRef.current.textContent = `${Math.floor(pos.x)}, ${Math.floor(pos.z)}`;
      }
    };

    tick();
    return () => cancelAnimationFrame(frame);
  }, [shown, map, mapSize, minimap, pan]);

  // The fold button only exists on a phone; the desktop keeps the panel as is.
  const collapsible = isMobileDevice();
  const collapsed = minimapCornerCollapsed.get();

  if (!shown) return null;

  // Folded: one small square where the panel was, the map glyph on it. The
  // map itself is not needed until it opens again.
  if (collapsible && collapsed) {
    return (
      <div
        className="minimap-corner-mini"
        title={t('minimap.expand')}
        onClick={() => runInAction(() => minimapCornerCollapsed.set(false))}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M4 5 L10 3 L15 5 L20 3 L20 19 L15 21 L10 19 L4 21 Z"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M10 3 L10 19 M15 5 L15 21" stroke="#fff" strokeWidth="1.2" />
        </svg>
      </div>
    );
  }

  if (!minimap) return null;

  const onWheel = (event: React.WheelEvent) => {
    setZoom(z =>
      Math.max(0, Math.min(ZOOM_LEVELS.length - 1, z + (event.deltaY < 0 ? 1 : -1)))
    );
  };

  const fold = () => runInAction(() => minimapCornerCollapsed.set(true));

  return (
    <>
    <div
      className="minimap-corner-panel"
      style={{ width: PANEL, height: PANEL, transform: `scale(${scale})` }}
      onWheel={onWheel}
      onContextMenu={e => e.preventDefault()}
    >
      <div className={`minimap-corner-clip${dragging ? ' is-dragging' : ''}`} {...handlers}>
        <div
          className="minimap-corner-spin"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div
            ref={pictureRef}
            className="minimap-corner-map"
            style={{
              width: mapSize,
              height: mapSize,
              backgroundImage: `url(${minimap.image.url})`,
            }}
          >
            {minimap.markers.map((marker, i) => (
              <MapMarker key={i} marker={marker} mapSize={mapSize} rotation={rotation} />
            ))}
            {partyMarkers.map((marker, i) => (
              <MapMarker key={`party-${i}`} marker={marker} mapSize={mapSize} rotation={rotation} />
            ))}
            <div
              ref={heroRef}
              className="minimap-corner-hero"
              style={{
                width: HERO_SIZE,
                height: HERO_SIZE,
                transform: `rotate(${-rotation}deg)`,
              }}
            >
              <Sprite file={HERO_SPRITE} size={HERO_SIZE} />
            </div>
          </div>
        </div>
      </div>
      <Frame width={PANEL} height={PANEL} />
      <div className="minimap-corner-bar" style={{ transform: `scale(${1 / PANEL_SCALE})` }}>
        {isPanned(pan) && <CenterButton onClick={() => setPan(NO_PAN)} />}
        <div ref={coordsRef} className="minimap-corner-coords" />
      </div>
    </div>
    {collapsible && (
      <div
        className="minimap-corner-collapse"
        title={t('minimap.collapse')}
        onClick={fold}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M5 12 H19" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </div>
    )}
    </>
  );
});
