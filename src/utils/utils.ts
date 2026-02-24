import * as mapboxPolyline from '@mapbox/polyline';
import gcoord from 'gcoord';
import { WebMercatorViewport } from 'viewport-mercator-project';
import { chinaGeojson } from '@/static/run_countries';
import { chinaCities } from '@/static/city';
import {
  MUNICIPALITY_CITIES_ARR,
  NEED_FIX_MAP,
  RUN_TITLES,
  MAIN_COLOR,
  RIDE_COLOR,
  VIRTUAL_RIDE_COLOR,
  HIKE_COLOR,
  SWIM_COLOR,
  ROWING_COLOR,
  ROAD_TRIP_COLOR,
  FLIGHT_COLOR,
  RUN_COLOR,
  KAYAKING_COLOR,
  SNOWBOARD_COLOR,
  TRAIL_RUN_COLOR,
} from './const';
import { FeatureCollection, LineString } from 'geojson';

export type Coordinate = [number, number];

export type RunIds = Array<number> | [];

export interface Activity {
  run_id: number;
  name: string;
  distance: number;
  moving_time: string;
  type: string;
  start_date: string;
  start_date_local: string;
  location_country: string;
  summary_polyline: string;
  average_heartrate?: number;
  average_speed: number;
  streak: number;
}

const titleForShow = (run: Activity): string => {
  const date = run.start_date_local.slice(0, 11);
  const distance = (run.distance / 1000.0).toFixed(2);
  let name = 'Run';
  if (run.name) {
    name = run.name;
  }
  return `${name} ${date} ${distance} KM ${
    !run.summary_polyline ? '(No map data for this workout)' : ''
  }`;
};

const formatPace = (d: number): string => {
  if (Number.isNaN(d) || d == 0) return '0';
  const pace = (1000.0 / 60.0) * (1.0 / d);
  const minutes = Math.floor(pace);
  const seconds = Math.floor((pace - minutes) * 60.0);
  return `${minutes}'${seconds.toFixed(0).toString().padStart(2, '0')}"`;
};

const formatSpeedOrPace = (speed: number, type: string): string => {
  if (Number.isNaN(speed) || speed === 0) return '0';

  if (type === 'Ride') {
    return `${(speed * 3.6).toFixed(2)} km/h`;
  }

  if (type === 'Swim') {
    const pace100m = 100.0 / speed; 
    const minutes = Math.floor(pace100m / 60.0);
    const seconds = Math.floor(pace100m - minutes * 60.0);
    return `${minutes}'${seconds.toFixed(0).toString().padStart(2, '0')}" /100m`;
  }
  
  return formatPace(speed);
};

const convertMovingTime2Sec = (moving_time: string): number => {
  if (!moving_time) {
    return 0;
  }
  // moving_time : '2 days, 12:34:56' or '12:34:56';
  const splits = moving_time.split(', ');
  const days = splits.length == 2 ? parseInt(splits[0]) : 0;
  const time = splits.splice(-1)[0];
  const [hours, minutes, seconds] = time.split(':').map(Number);
  const totalSeconds = ((days * 24 + hours) * 60 + minutes) * 60 + seconds;
  return totalSeconds;
};

const formatRunTime = (moving_time: string): string => {
  const totalSeconds = convertMovingTime2Sec(moving_time);
  const seconds = totalSeconds % 60;
  const minutes = (totalSeconds - seconds) / 60;
  if (minutes === 0) {
    return seconds + 's';
  }
  return minutes + 'min';
};

// for scroll to the map
const scrollToMap = () => {
  const el = document.querySelector('.fl.w-100.w-70-l');
  const rect = el?.getBoundingClientRect();
  if (rect) {
    window.scroll(rect.left + window.scrollX, rect.top + window.scrollY);
  }
};

const pattern = /([\u4e00-\u9fa5]{2,}(市|自治州|特别行政区|盟|地区))/g;
const extractLocations = (str: string): string[] => {
  const locations = [];
  let match;

  while ((match = pattern.exec(str)) !== null) {
    locations.push(match[0]);
  }

  return locations;
};

const cities = chinaCities.map((c) => c.name);
// what about oversea?
const locationForRun = (
  run: Activity
): {
  country: string;
  province: string;
  city: string;
} => {
  let location = run.location_country;
  let [city, province, country] = ['', '', ''];
  if (location) {
    // Only for Chinese now
    // should fiter 臺灣
    const cityMatch = extractLocations(location);
    const provinceMatch = location.match(/[\u4e00-\u9fa5]{2,}(省|自治区)/);

    if (cityMatch) {
      city = cities.find((value) => cityMatch.includes(value)) as string;
      if (!city) {
        city = '';
      }
    }
    if (provinceMatch) {
      [province] = provinceMatch;
    }
    const l = location.split(',');
    // or to handle keep location format
    let countryMatch = l[l.length - 1].match(
      /[\u4e00-\u9fa5].*[\u4e00-\u9fa5]/
    );
    if (!countryMatch && l.length >= 3) {
      countryMatch = l[2].match(/[\u4e00-\u9fa5].*[\u4e00-\u9fa5]/);
    }
    if (countryMatch) {
      [country] = countryMatch;
    }
  }
  if (MUNICIPALITY_CITIES_ARR.includes(city)) {
    province = city;
  }

  return { country, province, city };
};

const intComma = (x = '') => {
  if (x.toString().length <= 5) {
    return x;
  }
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const pathForRun = (run: Activity): Coordinate[] => {
  try {
    const c = mapboxPolyline.decode(run.summary_polyline);
    // reverse lat long for mapbox
    c.forEach((arr) => {
      [arr[0], arr[1]] = !NEED_FIX_MAP
        ? [arr[1], arr[0]]
        : gcoord.transform([arr[1], arr[0]], gcoord.GCJ02, gcoord.WGS84);
    });
    return c;
  } catch (err) {
    return [];
  }
};

const geoJsonForRuns = (runs: Activity[]): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  features: runs.map((run) => {
    const points = pathForRun(run);

    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: points,
        workoutType: run.type,
      },
      properties: {
        'color': colorFromType(run.type),
        'name': run.name,                           // 👈 新增：运动名称
        'distance': run.distance,                   // 👈 新增：运动距离
        'start_date_local': run.start_date_local,   // 👈 新增：运动时间
      },
      name: run.name,
    };
  }),
});

const geoJsonForMap = () => chinaGeojson;

const titleForType = (type: string): string => {
  switch (type) {
    case 'Run':
      return RUN_TITLES.RUN_TITLE;
    case 'Full Marathon':
      return RUN_TITLES.FULL_MARATHON_RUN_TITLE;
    case 'Half Marathon':
      return RUN_TITLES.HALF_MARATHON_RUN_TITLE;
    case 'Trail Run':
      return RUN_TITLES.TRAIL_RUN_TITLE;
    case 'Ride':
      return RUN_TITLES.RIDE_TITLE;
    case 'Indoor Ride':
      return RUN_TITLES.INDOOR_RIDE_TITLE;
    case 'VirtualRide':
      return RUN_TITLES.VIRTUAL_RIDE_TITLE;
    case 'Hike':
      return RUN_TITLES.HIKE_TITLE;
    case 'Rowing':
      return RUN_TITLES.ROWING_TITLE;
    case 'Swim':
      return RUN_TITLES.SWIM_TITLE;
    case 'RoadTrip':
      return RUN_TITLES.ROAD_TRIP_TITLE;
    case 'Flight':
      return RUN_TITLES.FLIGHT_TITLE;
    case 'Kayaking':
      return RUN_TITLES.KAYAKING_TITLE;
    case 'Snowboard':
      return RUN_TITLES.SNOWBOARD_TITLE;
    case 'Ski':
      return RUN_TITLES.SKI_TITLE;
    default:
      return RUN_TITLES.RUN_TITLE;
  }
}

const typeForRun = (run: Activity): string => {
  const type = run.type
  var distance = run.distance / 1000;
  switch (type) {
    case 'Run':
      if (distance >= 40) {
        return 'Full Marathon';
      }
      else if (distance > 20) {
        return 'Half Marathon';
      }
      return 'Run';
    case 'Trail Run':
      if (distance >= 40) {
        return 'Full Marathon';
      }
      else if (distance > 20) {
        return 'Half Marathon';
      }
      return 'Trail Run';
    case 'Ride':
      return 'Ride';
    case 'Indoor Ride':
      return 'Indoor Ride';
    case 'VirtualRide':
      return 'Virtual Ride';
    case 'Hike':
      return 'Hike';
    case 'Rowing':
      return 'Rowing';
    case 'Swim':
      return 'Swim';
    case 'RoadTrip':
      return 'RoadTrip';
    case 'Flight':
      return 'Flight';
    case 'Kayaking':
      return 'Kayaking';
    case 'Snowboard':
      return 'Snowboard';
    case 'Ski':
      return 'Ski';
    default:
      return 'Run';
  }
}

const titleForRun = (run: Activity): string => {
  const type = run.type;
  if (type == 'Run' || type == 'Trail Run'){
      const runDistance = run.distance / 1000;
      if (runDistance >= 40) {
        return RUN_TITLES.FULL_MARATHON_RUN_TITLE;
      }
      else if (runDistance > 20) {
        return RUN_TITLES.HALF_MARATHON_RUN_TITLE;
      }
  }
  return titleForType(type);
};

const colorFromType = (workoutType: string): string => {
  switch (workoutType) {
    case 'Run':
      return RUN_COLOR;
    case 'Trail Run':
      return TRAIL_RUN_COLOR;
    case 'Ride':
    case 'Indoor Ride':
      return RIDE_COLOR;
    case 'VirtualRide':
      return VIRTUAL_RIDE_COLOR;
    case 'Hike':
      return HIKE_COLOR;
    case 'Rowing':
      return ROWING_COLOR;
    case 'Swim':
      return SWIM_COLOR;
    case 'RoadTrip':
      return ROAD_TRIP_COLOR;
    case 'Flight':
      return FLIGHT_COLOR;
    case 'Kayaking':
      return KAYAKING_COLOR;
    case 'Snowboard':
    case 'Ski':
      return SNOWBOARD_COLOR;
    default:
      return MAIN_COLOR;
  }
};

export interface IViewState {
  longitude?: number;
  latitude?: number;
  zoom?: number;
}

const getBoundsForGeoData = (
  geoData: FeatureCollection<LineString>
): IViewState => {
  const { features } = geoData;
  let points: Coordinate[] = [];
  // find first have data
  for (const f of features) {
    if (f.geometry.coordinates.length) {
      points = f.geometry.coordinates as Coordinate[];
      break;
    }
  }
  if (points.length === 0) {
    return { longitude: 20, latitude: 20, zoom: 3 };
  }
  // Calculate corner values of bounds
  const pointsLong = points.map((point) => point[0]) as number[];
  const pointsLat = points.map((point) => point[1]) as number[];
  const cornersLongLat: [Coordinate, Coordinate] = [
    [Math.min(...pointsLong), Math.min(...pointsLat)],
    [Math.max(...pointsLong), Math.max(...pointsLat)],
  ];
  const viewState = new WebMercatorViewport({
    width: 800,
    height: 600,
  }).fitBounds(cornersLongLat, { padding: 200 });
  let { longitude, latitude, zoom } = viewState;
  if (features.length > 1) {
    zoom = 11.5;
  }
  return { longitude, latitude, zoom };
};

const filterYearRuns = (run: Activity, year: string) => {
  if (run && run.start_date_local) {
    return run.start_date_local.slice(0, 4) === year;
  }
  return false;
};

const filterCityRuns = (run: Activity, city: string) => {
  if (run && run.location_country) {
    return run.location_country.includes(city);
  }
  return false;
};
const filterTitleRuns = (run: Activity, title: string) =>
  titleForRun(run) === title;

const filterTypeRuns = (run: Activity, type: string) => {
  switch (type){
    case 'Full Marathon':
      return (run.type === 'Run' || run.type === 'Trail Run') && run.distance > 40000
    case 'Half Marathon':
      return (run.type === 'Run' || run.type === 'Trail Run') && run.distance < 40000 && run.distance > 20000
    default:
      return run.type === type
  }
}

const filterAndSortRuns = (
  activities: Activity[],
  item: string,
  filterFunc: (_run: Activity, _bvalue: string) => boolean,
  sortFunc: (_a: Activity, _b: Activity) => number,
  item2: string | null,
  filterFunc2: ((_run: Activity, _bvalue: string) => boolean) | null,
) => {
  let s = activities;
  if (item !== 'Total') {
    s = activities.filter((run) => filterFunc(run, item));
  }
  if(filterFunc2 != null && item2 != null){
    s = s.filter((run) => filterFunc2(run, item2));
  }
  return s.sort(sortFunc);
};

const sortDateFunc = (a: Activity, b: Activity) => {
  // @ts-ignore
  return (
    new Date(b.start_date_local.replace(' ', 'T')) -
    new Date(a.start_date_local.replace(' ', 'T'))
  );
};
const sortDateFuncReverse = (a: Activity, b: Activity) => sortDateFunc(b, a);

export {
  titleForShow,
  formatPace,
  formatSpeedOrPace,
  scrollToMap,
  locationForRun,
  intComma,
  pathForRun,
  geoJsonForRuns,
  geoJsonForMap,
  titleForRun,
  typeForRun,
  titleForType,
  filterYearRuns,
  filterCityRuns,
  filterTitleRuns,
  filterAndSortRuns,
  sortDateFunc,
  sortDateFuncReverse,
  getBoundsForGeoData,
  filterTypeRuns,
  colorFromType,
  formatRunTime,
  convertMovingTime2Sec,
  formatRunName,
  getHeartRateColor,
};

const getHeartRateColor = (bpm: number): string => {
  if (bpm < 100) return '#e0e0e0'; // 亮银灰 (热身/拉伸/日常行走)
  if (bpm < 115) return '#81d4fa'; // 亮天蓝 (Zone 1: 轻松恢复区)
  if (bpm < 130) return '#a5d6a7'; // 清新浅绿 (Zone 2: 黄金燃脂区)
  if (bpm < 145) return '#ffd54f'; // 明亮黄 (Zone 3: 有氧进阶区，微微气喘)
  if (bpm < 160) return '#ffb74d'; // 亮橙色 (Zone 4: 乳酸阈值，比较痛苦)
  return '#ff8a80';                // 珊瑚红 (Zone 5: 无氧极限，冲刺)
};

const formatRunName = (name: string, startDateLocal: string, type: string): string => {
  // 1. 获取运动的小时数 (把空格替换为T是为了兼容不同浏览器的日期解析)
  const date = new Date(startDateLocal.replace(' ', 'T'));
  const hour = date.getHours();

  // 2. 咱们自己定义的精准时段划分
  let timePrefix = '';
  // 晚上 23点到24点，或者 凌晨 0点到2点
  if (hour >= 23 || hour < 2) timePrefix = '深夜'; 
  // 凌晨 2点到5点
  else if (hour >= 2 && hour < 5) timePrefix = '凌晨'; 
  // 早上 5点到7点
  else if (hour >= 5 && hour < 7) timePrefix = '清晨'; 
  // 上午 7点到11点
  else if (hour >= 7 && hour < 11) timePrefix = '上午'; 
  // 中午 11点到13点
  else if (hour >= 11 && hour < 13) timePrefix = '中午'; 
  // 下午 13点到18点
  else if (hour >= 13 && hour < 18) timePrefix = '下午'; 
  // 傍晚 18点到20点
  else if (hour >= 18 && hour < 20) timePrefix = '傍晚'; 
  // 剩下的就是晚上 20点到23点
  else timePrefix = '夜间';

  // 3. 定义运动的中文名称
  let typeStr = '';
  switch (type) {
    case 'Run': typeStr = '跑步'; break;
    case 'Ride': typeStr = '骑行'; break;
    case 'Swim': typeStr = '游泳'; break;
    case 'Hike':
    case 'Walk': typeStr = '行走'; break;
    default: typeStr = '运动';
  }

  // 4. 判断原名称是否是 Strava 的“系统流水线名字”
  const isDefaultName =
    /^(晨间|上午|午间|午后|下午|傍晚|晚间|夜间|凌晨|清晨|Morning|Afternoon|Evening|Night|Lunch)/.test(name) &&
    /(跑步|骑行|行走|徒步|游泳|运动|Run|Ride|Walk|Swim|Hike)$/.test(name) &&
    name.length <= 15;

  // 如果是系统默认的没营养的名字，就换成咱们自己精准定义的名字
  if (isDefaultName || name === 'Run' || name === 'Ride') {
    return `${timePrefix}${typeStr}`;
  }

  // 如果是你自己手动改过的特殊名字（比如“千岛湖骑行”），就原样保留
  return name;
};