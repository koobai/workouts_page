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
  const keepWhenLightsOff = ['runs2']
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
  const [animationPoints, setAnimationPoints] = useState(0);
  const [hoverInfo, setHoverInfo] = useState<{
    longitude: number;
    latitude: number;
    features: any[];
  } | null>(null);

  useEffect(() => {
    if (geoData && geoData.features && geoData.features.length === 1) {
      const totalPoints = geoData.features[0].geometry.coordinates.length;
      let current = 0;
      let animationFrameId: number;

      const animate = () => {
        let step = totalPoints / 300;
        if (step < 0.5) step = 0.5;

        current += step;
        if (current <= totalPoints) {
          setAnimationPoints(Math.floor(current)); // 取整后截取坐标
          animationFrameId = requestAnimationFrame(animate);
        } else {
          setAnimationPoints(totalPoints); // 画完了
        }
      };
      animate();

      return () => cancelAnimationFrame(animationFrameId);
    } else {
      // 全局概览模式：不播动画
      setAnimationPoints(0);
    }
  }, [geoData]);

  // 根据动画进度，动态截取坐标点
  const displayData = useMemo(() => {
    if (geoData && geoData.features.length === 1 && animationPoints > 0) {
      const feature = geoData.features[0];
      return {
        ...geoData,
        features: [
          {
            ...feature,
            geometry: {
              ...feature.geometry,
              coordinates: feature.geometry.coordinates.slice(0, animationPoints),
            },
          },
        ],
      };
    }
    return geoData; // 全局模式直接返回完整数据
  }, [geoData, animationPoints]);
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
      mapStyle="mapbox://styles/mapbox/dark-v10"
      ref={mapRefCallback}
      mapboxAccessToken={MAPBOX_TOKEN}
      interactiveLayerIds={['runs2-hover-area']}
      onMouseMove={(e) => {          
        if (e.features && e.features.length > 0) {
          setHoverInfo({
            longitude: e.lngLat.lng,
            latitude: e.lngLat.lat,
            features: e.features,
          });
        } else {
          setHoverInfo(null);
        }
      }}
      onMouseLeave={() => setHoverInfo(null)} // 👈 3. 鼠标移开时清空
    >
      <RunMapButtons changeYear={changeYear} thisYear={thisYear} />
      <Source id="data" type="geojson" data={displayData}>
        <Layer
          id="province"
          type="fill"
          paint={{
            'fill-color': PROVINCE_FILL_COLOR,
            'fill-opacity': 0.2,
          }}
          filter={filterProvinces}
        />
        <Layer
          id="countries"
          type="fill"
          paint={{
            'fill-color': COUNTRY_FILL_COLOR,
            'fill-opacity': 0.5,
          }}
          filter={filterCountries}
        />
        <Layer
          id="runs2"
          type="line"
          paint={{
            'line-color': ['get', 'color'], // 基础颜色保持不变
            'line-width': isSingleRun ? 5 : (isBigMap && lights ? 1 : 2),
            'line-width-transition': { duration: 0 },
            
            'line-dasharray': dash,
            'line-opacity': isSingleRun || isBigMap || !lights ? 1 : LINE_OPACITY,
            'line-opacity-transition': { duration: 0 },
            'line-blur': 1,
          }}
          layout={{
            'line-join': 'round',
            'line-cap': 'round',
          }}
        />
        <Layer
          id="runs2-hover-area"
          type="line"
          paint={{
            'line-width': 20, 
            'line-opacity': 0
          }}
        />
      </Source>
      {isSingleRun && (
        <RunMarker
          startLat={startLat}
          startLon={startLon}
          endLat={endLat}
          endLon={endLon}
        />
      )}
      <span className={styles.runTitle}>{title}</span>
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
                const sortedFeatures = [...hoverInfo.features].sort((a, b) => 
                  new Date(b.properties.start_date_local.replace(' ', 'T')).getTime() - 
                  new Date(a.properties.start_date_local.replace(' ', 'T')).getTime()
                );
                
                const earliestRun = sortedFeatures[sortedFeatures.length - 1];
                const totalOverlappedDistance = sortedFeatures.reduce((sum, f) => sum + f.properties.distance, 0) / 1000;

                return (
                  <div className={styles.multiWrapper}>
                    <div className={styles.multiStat}>
                      此路段共经过 {hoverInfo.features.length} 次
                    </div>
                    <div className={styles.multiStat}>
                      总里程 {totalOverlappedDistance.toFixed(1)} KM
                    </div>
                    <div className={styles.multiDate}>
                      首次经过 {earliestRun.properties.start_date_local.slice(0, 10)}
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
