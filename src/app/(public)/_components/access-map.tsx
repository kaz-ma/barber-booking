import { useTranslations } from 'next-intl'
import {
  BLOCKS,
  FOOTBRIDGE,
  MAJOR_ROADS,
  MAP_SIZE,
  MINOR_ROADS,
  POINTS,
  RAILWAYS,
  ROUTE,
  STATION_BUILDINGS,
  TRAMWAY,
} from './access-map-geometry'
import { MapReveal } from './map-reveal'

/**
 * Landmark-based access map (inline SVG, no third-party tiles or scripts). Geometry comes from
 * OpenStreetMap via scripts/access-map/build.py; labels are translated here. The walking route
 * runs from the JR Tennoji Central Exit down the Harukas side of Abenosuji to the shop.
 */
export function AccessMap() {
  const t = useTranslations('home.map')
  const tHome = useTranslations('home')
  const { shop, jrGate, kintetsu, abenoMetro, harukas, qsmall, tokiwa, footbridge } = POINTS
  return (
    <MapReveal>
      <svg viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`} role="img" aria-labelledby="amap-desc">
        <desc id="amap-desc">{tHome('mapAlt')}</desc>
        <rect className="amap-land" width={MAP_SIZE.width} height={MAP_SIZE.height} />
        <g className="amap-landmark">
          {STATION_BUILDINGS.map((d) => (
            <path key={d} d={d} />
          ))}
          <path d={BLOCKS.harukas} />
          <path d={BLOCKS.qsmall} />
        </g>
        <g className="amap-road minor">
          {MINOR_ROADS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g className="amap-road major">
          {MAJOR_ROADS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g className="amap-rail">
          {RAILWAYS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g className="amap-tram">
          {TRAMWAY.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g className="amap-bridge">
          {FOOTBRIDGE.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <mask id="amap-route-mask" maskUnits="userSpaceOnUse">
          <path className="route-draw" d={ROUTE} pathLength={1} fill="none" stroke="#fff" strokeWidth={10} />
        </mask>
        <path className="amap-route" d={ROUTE} mask="url(#amap-route-mask)" />
        <path className="amap-shop-bldg" d={BLOCKS.shop} />

        <g className="amap-label">
          <text x={jrGate.x + 6} y={jrGate.y - 30} className="lg">
            {t('jr')}
          </text>
          <text x={jrGate.x + 8} y={jrGate.y + 4}>
            {t('jrGate')}
          </text>
          <text x={harukas.x + 6} y={harukas.y + 8} textAnchor="middle" className="lg">
            {t('harukas')}
          </text>
          <text x={kintetsu.x + 30} y={kintetsu.y + 22} textAnchor="end">
            {t('kintetsu')}
          </text>
          <text x={qsmall.x} y={qsmall.y + 4} textAnchor="middle" className="lg">
            {t('qsmall')}
          </text>
          <text x={tokiwa.x + 40} y={tokiwa.y - 4}>
            {t('tokiwa')}
          </text>
          <text x={abenoMetro.x - 8} y={abenoMetro.y + 4} textAnchor="end">
            {t('metro')}
          </text>
          <text
            x={0}
            y={0}
            className="road"
            textAnchor="middle"
            transform={`translate(${shop.x - 12} ${shop.y + 78}) rotate(-82)`}
          >
            {t('abenosuji')}
          </text>
          <text x={footbridge.x - 14} y={footbridge.y - 6} textAnchor="end">
            {t('footbridge')}
          </text>
          <text x={shop.x - 34} y={shop.y + 118} textAnchor="end" className="tram">
            {t('tram')}
          </text>
        </g>

        <g className="amap-marker">
          <circle cx={jrGate.x} cy={jrGate.y} r={4} />
          <circle cx={kintetsu.x} cy={kintetsu.y} r={4} />
          <circle cx={abenoMetro.x} cy={abenoMetro.y} r={4} />
        </g>

        <g className="amap-pin" transform={`translate(${shop.x} ${shop.y})`}>
          <g className="route-end">
            <circle r={9} className="halo" />
            <circle r={5} />
            <g transform="translate(14 -13)">
              <rect width={126} height={26} rx={3} />
              <text x={8} y={17} className="name" lang="en">
                Neuer Barber
              </text>
              <text x={118} y={17} textAnchor="end" className="floor">
                {t('floor')}
              </text>
            </g>
          </g>
        </g>

        <g className="amap-north" transform={`translate(${MAP_SIZE.width - 22} 24)`}>
          <path d="M0 -12 L6 6 L0 2 L-6 6 Z" />
          <text y={18} textAnchor="middle">
            N
          </text>
        </g>
      </svg>
      <figcaption>
        <span className="legend">
          <i aria-hidden="true" />
          {t('routeLegend')}
        </span>
        <span className="attr">{t('attribution')}</span>
      </figcaption>
    </MapReveal>
  )
}
