import MapboxLanguage from '@mapbox/mapbox-gl-language';
import React, {useRef, useCallback, useState, useEffect, useMemo} from 'react';
import Map, {Layer, Source, FullscreenControl, NavigationControl, MapRef} from 'react-map-gl';
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
} from '@/utils/const';
import { Coordinate, IViewState, geoJsonForMap } from '@/utils/utils';
import RunMarker from './RunMarker';
import RunMapButtons from './RunMapButtons';
import styles from './style.module.scss';
import { FeatureCollection } from 'geojson';
import { RPGeometry } from '@/static/run_countries';
import './mapbox.css';

interface IRunMapProps {
  title: string;
  viewState: IViewState;
  setViewState: (_viewState: IViewState) => void;
  changeYear: (_year: string) => void;
  geoData: FeatureCollection<RPGeometry>;
  thisYear: string;
}

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

  const [animationProgress, setAnimationProgress] = useState(0);

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
          }, 1000); 
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
        if (mapRef.current) mapRef.current.getMap()?.stop();
      };
    } else {
      setAnimationProgress(0);
      if (map.getPitch() > 0 || map.getBearing() !== 0) {
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 }); 
      }
    }
  }, [geoData]); 

  const displayData = useMemo(() => {
    if (geoData && geoData.features.length === 1 && animationProgress > 0) {
      const feature = geoData.features[0];
      const points = feature.geometry.coordinates as Coordinate[];
      const idx = Math.floor(animationProgress);
      const remainder = animationProgress - idx;

      const coords = points.slice(0, idx + 1);

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

  const mapRefCallback = useCallback(
    (ref: MapRef) => {
      if (ref !== null) {
        const map = ref.getMap();
        if (map && IS_CHINESE) {
            map.addControl(new MapboxLanguage({defaultLanguage: 'zh-Hans'}));
        }
        map.on('style.load', () => {
          if (!ROAD_LABEL_DISPLAY) {
            MAP_LAYER_LIST.forEach((layerId) => {
              map.removeLayer(layerId);
            });
          }
          mapRef.current = ref;
        });
      }
    },
    []
  );

  const filterProvinces = provinces.slice();
  const filterCountries = countries.slice();
  filterProvinces.unshift('in', 'name');
  filterCountries.unshift('in', 'name');

  const initGeoDataLength = geoData.features.length;
  const isBigMap = (viewState.zoom ?? 0) <= 3;
  if (isBigMap && IS_CHINESE) {
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

  return (
    <Map
      {...viewState}
      onMove={onMove}
      style={style}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      ref={mapRefCallback}
      mapboxAccessToken={MAPBOX_TOKEN}
      logoPosition="bottom-right"
      attributionControl={false} 
      fog={{
        range: [0.8, 3.5],
        color: "#151516",
        "horizon-blend": 0.15,
        "star-intensity": 0.2
      }}
      terrain={isSingleRun ? { source: 'mapbox-dem', exaggeration: 2.5 } : undefined}
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
            'line-width': isSingleRun ? 5 : (isBigMap ? 1 : 2),
            'line-dasharray': dash,
            'line-opacity': isSingleRun || isBigMap ? 1 : LINE_OPACITY,
            'line-blur': 1,
          }}
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        />
      </Source>

      {isSingleRun && (
        <RunMarker startLat={startLat} startLon={startLon} endLat={endLat} endLon={endLon} />
      )}
      
      {/* 🌟 核心排版：全部移到左边 (去掉了灯光控件) */}
      <FullscreenControl position="top-left" />
      <NavigationControl showCompass={false} position="bottom-left" />
    </Map>
  );
};

export default RunMap;