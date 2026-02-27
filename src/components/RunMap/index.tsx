import MapboxLanguage from '@mapbox/mapbox-gl-language';
import React, {useRef, useCallback, useState, useEffect, useMemo} from 'react';
import Map, {Layer, Source, FullscreenControl, NavigationControl, MapRef, Popup} from 'react-map-gl';
import {MapInstance} from "react-map-gl/src/types/lib";
import useActivities from '@/hooks/useActivities';
import {
  MAP_LAYER_LIST,
  IS_CHINESE,
  ROAD_LABEL_DISPLAY,
  MAIN_COLOR,
  MAPBOX_TOKEN,
  PROVINCE_FILL_COLOR,
  COUNTRY_FILL_COLOR,
  USE_DASH_LINE,
  LINE_OPACITY,
  MAP_HEIGHT,
  PRIVACY_MODE,
  LIGHTS_ON,
} from '@/utils/const';
import { Coordinate, IViewState, geoJsonForMap } from '@/utils/utils';
import RunMarker from './RunMarker';
import RunMapButtons from './RunMapButtons';
import styles from './style.module.scss';
import { FeatureCollection } from 'geojson';
import { RPGeometry } from '@/static/run_countries';
import './mapbox.css';
import LightsControl from "@/components/RunMap/LightsControl";

interface IRunMapProps {
  title: string;
  viewState: IViewState;
  setViewState: (_viewState: IViewState) => void;
  changeYear: (_year: string) => void;
  geoData: FeatureCollection<RPGeometry>;
  thisYear: string;
}
// 🌟 辅助函数：计算两点之间的真实朝向角度 (Bearing)，让镜头永远看前方
const calculateBearing = (start: number[], end: number[]) => {
  const PI = Math.PI;
  const lat1 = (start[1] * PI) / 180;
  const lon1 = (start[0] * PI) / 180;
  const lat2 = (end[1] * PI) / 180;
  const lon2 = (end[0] * PI) / 180;
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / PI + 360) % 360;
};
const RunMap = ({
  title,
  viewState,
  setViewState,
  changeYear,
  geoData,
  thisYear,
}: IRunMapProps) => {
  const { countries, provinces } = useActivities();
  const mapRef = useRef<MapRef>();
  const [lights, setLights] = useState(PRIVACY_MODE ? false : LIGHTS_ON);
  const keepWhenLightsOff = ['runs2', 'runs2-hover-area']
  function switchLayerVisibility(map: MapInstance, lights: boolean) {
    const styleJson = map.getStyle();
    styleJson.layers.forEach(it => {
      if (!keepWhenLightsOff.includes(it.id)) {
        if (lights)
          map.setLayoutProperty(it.id, 'visibility', 'visible');
        else
          map.setLayoutProperty(it.id, 'visibility', 'none');
      }
    })
  }
  // --- 轨迹动画逻辑开始 ---
  const [animationProgress, setAnimationProgress] = useState(0);
  const [hoverInfo, setHoverInfo] = useState<{
    longitude: number;
    latitude: number;
    features: any[];
  } | null>(null);

  // 🌟 上帝视角与第一人称丝滑运镜引擎
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.stop();

    if (geoData && geoData.features && geoData.features.length === 1) {
      const points = geoData.features[0].geometry.coordinates as Coordinate[];
      const totalPoints = points.length;
      if (totalPoints < 2) return;

      let current = 0;
      let animationFrameId: number;
      let isAnimating = true;

      const startBearing = calculateBearing(points[0], points[Math.min(5, totalPoints - 1)]);
      let currentBearing = startBearing; 

      map.flyTo({
        center: points[0] as [number, number],
        bearing: startBearing,
        pitch: 70,    
        zoom: 16,   
        duration: 2500, 
        essential: true
      });

      const animate = () => {
        if (!isAnimating) return;

        let step = totalPoints / 1500;
        if (step > 0.3) step = 0.3;
        if (step < 0.06) step = 0.06;

        current += step;
        if (current < totalPoints - 1) {
          setAnimationProgress(current);

          const idx = Math.floor(current);
          const remainder = current - idx;
          const p1 = points[idx];
          const p2 = points[idx + 1];
          const lng = p1[0] + (p2[0] - p1[0]) * remainder;
          const lat = p1[1] + (p2[1] - p1[1]) * remainder;

          const lookAheadIdx = Math.min(idx + Math.floor(totalPoints / 15) + 1, totalPoints - 1);
          const targetBearing = calculateBearing([lng, lat], points[lookAheadIdx]);
          
          let diff = targetBearing - currentBearing;
          diff = ((diff + 540) % 360) - 180; 
          currentBearing += diff * 0.05; 

          map.easeTo({
            center: [lng, lat],
            bearing: currentBearing,
            pitch: 70,   
            zoom: 16,
            duration: 32, 
            easing: (t) => t
          });

          animationFrameId = requestAnimationFrame(animate);
        } else {
          setAnimationProgress(totalPoints); 
          
          setTimeout(() => {
            if (!isAnimating) return;
            const lons = points.map(p => p[0]);
            const lats = points.map(p => p[1]);
            const bounds = [
              [Math.min(...lons), Math.min(...lats)],
              [Math.max(...lons), Math.max(...lats)]
            ] as [[number, number], [number, number]];

            map.fitBounds(bounds, {
              padding: { top: 60, bottom: 60, left: 60, right: 60 },
              pitch: 0,     
              bearing: 0,   
              duration: 3000 
            });
          }, 1000); // 你刚改的完美 1 秒停顿
        }
      };

      setTimeout(() => {
        if (isAnimating) {
          animationFrameId = requestAnimationFrame(animate);
        }
      }, 2600);

      return () => {
        isAnimating = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        // 🛑 核心防闪烁魔法 2：组件卸载或数据突变时，再次踩下刹车！
        if (mapRef.current) mapRef.current.getMap()?.stop();
      };
    } else {
      setAnimationProgress(0);
      // 如果切回全局年份时还在 3D 视角，快速且平滑地拉平
      if (map.getPitch() > 0 || map.getBearing() !== 0) {
        // 时间缩短到 800ms，让切年份的回退动作更加干脆，不拖泥带水
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 }); 
      }
    }
  }, [geoData]); // 监听 geoData 的变化

  // 根据动画进度，动态截取坐标点
const displayData = useMemo(() => {
    if (geoData && geoData.features.length === 1 && animationProgress > 0) {
      const feature = geoData.features[0];
      const points = feature.geometry.coordinates as Coordinate[];
      const idx = Math.floor(animationProgress);
      const remainder = animationProgress - idx;

      // 截取已经跑完的完整点位
      const coords = points.slice(0, idx + 1);

      // 如果还没跑完最后一点，就算出当前镜头所在的精确坐标，追加到线条末端！
      if (idx < points.length - 1 && remainder > 0) {
        const p1 = points[idx];
        const p2 = points[idx + 1];
        const lng = p1[0] + (p2[0] - p1[0]) * remainder;
        const lat = p1[1] + (p2[1] - p1[1]) * remainder;
        coords.push([lng, lat]);
      }

      return {
        ...geoData,
        features: [
          {
            ...feature,
            geometry: {
              ...feature.geometry,
              coordinates: coords,
            },
          },
        ],
      };
    }
    return geoData; 
  }, [geoData, animationProgress]);
  // --- 轨迹动画逻辑结束 ---
  const mapRefCallback = useCallback(
    (ref: MapRef) => {
      if (ref !== null) {
        const map = ref.getMap();
        if (map && IS_CHINESE) {
            map.addControl(new MapboxLanguage({defaultLanguage: 'zh-Hans'}));
        }
        // all style resources have been downloaded
        // and the first visually complete rendering of the base style has occurred.
        map.on('style.load', () => {
          if (!ROAD_LABEL_DISPLAY) {
            MAP_LAYER_LIST.forEach((layerId) => {
              map.removeLayer(layerId);
            });
          }
          mapRef.current = ref;
          switchLayerVisibility(map, lights);
        });
      }
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        switchLayerVisibility(map, lights);
      }
    },
    [mapRef, lights]
  );
  const filterProvinces = provinces.slice();
  const filterCountries = countries.slice();
  // for geojson format
  filterProvinces.unshift('in', 'name');
  filterCountries.unshift('in', 'name');

  const initGeoDataLength = geoData.features.length;
  const isBigMap = (viewState.zoom ?? 0) <= 3;
  if (isBigMap && IS_CHINESE) {
    // Show boundary and line together, combine geoData(only when not combine yet)
    if(geoData.features.length === initGeoDataLength){
      geoData = {
          "type": "FeatureCollection",
          "features": geoData.features.concat(geoJsonForMap().features)
      };
    }
  }

  const isSingleRun =
    geoData.features.length === 1 &&
    geoData.features[0].geometry.coordinates.length;
  let startLon = 0;
  let startLat = 0;
  let endLon = 0;
  let endLat = 0;
  if (isSingleRun) {
    const points = geoData.features[0].geometry.coordinates as Coordinate[];
    [startLon, startLat] = points[0];
    [endLon, endLat] = points[points.length - 1];
  }
  let dash = USE_DASH_LINE && !isSingleRun && !isBigMap ? [2, 2] : [2, 0];
  const onMove = React.useCallback(({ viewState }: { viewState: IViewState }) => {
    setViewState(viewState);
  }, []);
  const style: React.CSSProperties = {
    width: '100%',
    height: MAP_HEIGHT,
  };
  const fullscreenButton: React.CSSProperties = {
    position: 'absolute',
    marginTop: '29.2px',
    right: '0px',
    opacity: 0.3,
  };

  return (
    <Map
      {...viewState}
      onMove={onMove}
      style={style}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      ref={mapRefCallback}
      mapboxAccessToken={MAPBOX_TOKEN}
      interactiveLayerIds={['runs2-hover-area']}
      // 🌟 1. 核心修复：Fog 和 Terrain 是直接写在 Map 上的属性！
      fog={{
        range: [0.8, 3.5],
        color: "#151516",
        "horizon-blend": 0.15,
        "star-intensity": 0.2
      }}
      terrain={isSingleRun ? { source: 'mapbox-dem', exaggeration: 2.5 } : undefined}
      onMouseMove={(e) => {          
        if (e.features && e.features.length > 0) {
          const validRuns = e.features.filter(
            (f) => f.properties && f.properties.start_date_local
          );
          if (validRuns.length > 0) {
            setHoverInfo({
              longitude: e.lngLat.lng,
              latitude: e.lngLat.lat,
              features: validRuns,
            });
            return;
          }
        }
        setHoverInfo(null);
      }}
      onMouseLeave={() => setHoverInfo(null)}
    >
      <Layer
        id="3d-buildings"
        source="composite"
        source-layer="building"
        filter={['==', 'extrude', 'true']}
        type="fill-extrusion"
        minzoom={14}
        paint={{
          'fill-extrusion-color': '#1C1C1E', 
          'fill-extrusion-height': ['*', ['get', 'height'], 4.0],
          'fill-extrusion-base': ['*', ['get', 'min_height'], 4.0],
          'fill-extrusion-opacity': 0.85,
        }}
      />

      <Source
        id="mapbox-dem"
        type="raster-dem"
        url="mapbox://mapbox.mapbox-terrain-dem-v1"
        tileSize={512}
        maxzoom={14}
      />

      <Source id="data" type="geojson" data={displayData}>
        <Layer
          id="runs2"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': isSingleRun ? 5 : (isBigMap && lights ? 1 : 2),
            'line-dasharray': dash,
            'line-opacity': isSingleRun || isBigMap || !lights ? 1 : LINE_OPACITY,
            'line-blur': 1,
          }}
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        />
        <Layer id="runs2-hover-area" type="line" paint={{ 'line-width': 20, 'line-opacity': 0 }} />
      </Source>

      {isSingleRun && (
        <RunMarker startLat={startLat} startLon={startLon} endLat={endLat} endLon={endLon} />
      )}
      
      <FullscreenControl style={fullscreenButton}/>
      {!PRIVACY_MODE && <LightsControl setLights={setLights} lights={lights}/>}
      <NavigationControl showCompass={false} position={'bottom-right'} style={{opacity: 0.3}}/>

      {hoverInfo && hoverInfo.features && hoverInfo.features.length > 0 && (
        <Popup
          longitude={hoverInfo.longitude}
          latitude={hoverInfo.latitude}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={10}
          className={styles.popupWrapper}
        >
          <style>{`
            .mapboxgl-popup-content {
              background: none !important;
              padding: 0 !important;
              box-shadow: none !important;
            }
            .mapboxgl-popup-tip {
              display: none !important;
            }
          `}</style>
          
          <div className={styles.tooltipContainer}>
            {/* 只有 1 条路线时 */}
            {hoverInfo.features.length === 1 ? (
              <div className={styles.singleWrapper}>
                <div className={styles.singleTitle} style={{ color: hoverInfo.features[0].properties.color }}>
                  {hoverInfo.features[0].properties.name}
                </div>
                <div className={styles.subText}>
                  {hoverInfo.features[0].properties.start_date_local.slice(0, 10)} · {(hoverInfo.features[0].properties.distance / 1000).toFixed(2)} KM
                </div>
              </div>
            ) : (
              /* 有多条重叠路线时：拆分为清晰的 4 行 */
              (() => {
                const sortedFeatures = [...hoverInfo.features].sort((a, b) => {
                  const timeA = a.properties?.start_date_local ? new Date(a.properties.start_date_local.replace(' ', 'T')).getTime() : 0;
                  const timeB = b.properties?.start_date_local ? new Date(b.properties.start_date_local.replace(' ', 'T')).getTime() : 0;
                  return timeB - timeA;
                });
                
                const earliestRun = sortedFeatures[sortedFeatures.length - 1];
                const totalOverlappedDistance = sortedFeatures.reduce((sum, f) => sum + f.properties.distance, 0) / 1000;

                return (
                  <div className={styles.multiWrapper}>
                    <div className={styles.multiStat}>
                      此路段共经过 {hoverInfo.features.length} 趟
                    </div>
                    <div className={styles.multiStat}>
                      总里程 {totalOverlappedDistance.toFixed(1)} KM
                    </div>
                    <div className={styles.multiDate}>
                      首趟经过 {earliestRun.properties.start_date_local.slice(0, 10)}
                    </div>
                    <div className={styles.multiActivity}>
                      <span style={{ color: earliestRun.properties.color }}>{earliestRun.properties.name}</span> {(earliestRun.properties.distance / 1000).toFixed(2)} KM
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </Popup>
      )}
    </Map>
  );
};

export default RunMap;
