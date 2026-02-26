import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Layout from '@/components/Layout';
import LocationStat from '@/components/LocationStat';
import RunMap from '@/components/RunMap';
import RunTable from '@/components/RunTable';
import SVGStat from '@/components/SVGStat';
import YearsStat from '@/components/YearsStat';
import useActivities from '@/hooks/useActivities';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import { IS_CHINESE } from '@/utils/const';
import {
  Activity,
  IViewState,
  filterAndSortRuns,
  filterCityRuns,
  filterTitleRuns,
  filterTypeRuns,
  filterYearRuns,
  geoJsonForRuns,
  getBoundsForGeoData,
  scrollToMap,
  sortDateFunc,
  titleForShow,
  RunIds,
} from '@/utils/utils';

const Index = () => {
  const { siteTitle } = useSiteMetadata();
  const { activities, thisYear } = useActivities();
  const [year, setYear] = useState(thisYear);
  const [runIndex, setRunIndex] = useState(-1);
  const [runs, setActivity] = useState(
    filterAndSortRuns(activities, year, filterYearRuns, sortDateFunc)
  );
  const [title, setTitle] = useState('');
  const [geoData, setGeoData] = useState(geoJsonForRuns(runs));
  // for auto zoom
  const bounds = getBoundsForGeoData(geoData);
  const [intervalId, setIntervalId] = useState<number>();

  const [viewState, setViewState] = useState<IViewState>({
    ...bounds,
  });

  const changeByItem = (
    item: string,
    name: string,
    func: (_run: Activity, _value: string) => boolean
  ) => {
    scrollToMap();
    if (name != 'Year') {
      setYear(thisYear)
    }
    setActivity(filterAndSortRuns(activities, item, func, sortDateFunc));
    setRunIndex(-1);
    setTitle(`${item} ${name} Heatmap`);
  };

  const changeYear = (y: string) => {
    // default year
    setYear(y);

    if ((viewState.zoom ?? 0) > 3 && bounds) {
      setViewState({
        ...bounds,
      });
    }

    changeByItem(y, 'Year', filterYearRuns);
    clearInterval(intervalId);
  };

  const changeCity = (city: string) => {
    changeByItem(city, 'City', filterCityRuns);
  };

  const changeTitle = (title: string) => {
    changeByItem(title, 'Title', filterTitleRuns);
  };

  const changeType = (type: string) => {
    changeByItem(type, 'Type', filterTypeRuns);
  };

  const changeTypeInYear = (year:string, type: string) => {
    scrollToMap();
    // type in year, filter year first, then type
    if(year != 'Total'){
      setYear(year);
      setActivity(filterAndSortRuns(activities, year, filterYearRuns, sortDateFunc, type, filterTypeRuns));
    }
    else {
      setYear(thisYear);
      setActivity(filterAndSortRuns(activities, type, filterTypeRuns, sortDateFunc));
    }
    setRunIndex(-1);
    setTitle(`${year} ${type} Type Heatmap`);
  };


  const locateActivity = (runIds: RunIds) => {
    const ids = new Set(runIds);

    const selectedRuns = !runIds.length
      ? runs
      : runs.filter((r: any) => ids.has(r.run_id));

    if (!selectedRuns.length) {
      return;
    }

    const lastRun = selectedRuns.sort(sortDateFunc)[0];

    if (!lastRun) {
      return;
    }
    setGeoData(geoJsonForRuns(selectedRuns));
    setTitle(titleForShow(lastRun));
    clearInterval(intervalId);
    scrollToMap();
  };

  useEffect(() => {
    setViewState({
      ...bounds,
    });
  }, [geoData]);

  useEffect(() => {
    const runsNum = runs.length;
    // maybe change 20 ?
    const sliceNum = runsNum >= 10 ? runsNum / 10 : 1;
    let i = sliceNum;
    const id = setInterval(() => {
      if (i >= runsNum) {
        clearInterval(id);
      }

      const tempRuns = runs.slice(0, i);
      setGeoData(geoJsonForRuns(tempRuns));
      i += sliceNum;
    }, 10);
    setIntervalId(id);
  }, [runs]);

  useEffect(() => {
    if (year !== 'Total') {
      return;
    }

    let svgStat = document.getElementById('svgStat');
    if (!svgStat) {
      return;
    }

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'path') {
        // Use querySelector to get the <desc> element and the <title> element.
        const descEl = target.querySelector('desc');
        if (descEl) {
          // If the runId exists in the <desc> element, it means that a running route has been clicked.
          const runId = Number(descEl.innerHTML);
          if (!runId) {
            return;
          }
          locateActivity([runId]);
          return;
        }

        const titleEl = target.querySelector('title');
        if (titleEl) {
          // If the runDate exists in the <title> element, it means that a date square has been clicked.
          const [runDate] = titleEl.innerHTML.match(/\d{4}-\d{1,2}-\d{1,2}/) || [
            `${+thisYear + 1}`,
          ];
          const runIDsOnDate = runs
            .filter((r) => r.start_date_local.slice(0, 10) === runDate)
            .map((r) => r.run_id);
          if (!runIDsOnDate.length) {
            return;
          }
          locateActivity(runIDsOnDate);
        }
      }
    }
    svgStat.addEventListener('click', handleClick);
    return () => {
      svgStat && svgStat.removeEventListener('click', handleClick);
    };
  }, [year]);
// --- 👇 完整版数据计算面板 👇 ---
  // 1. 基础数据
  const totalDistance = (runs.reduce((acc, run) => acc + (run.distance || 0), 0) / 1000).toFixed(1);
  const activeDays = new Set(runs.map(r => r.start_date_local.slice(0, 10))).size;

  // 2. 分类里程 (骑行 vs 跑走)
  const rideDistance = (runs.filter(r => r.type === 'Ride' || r.type === 'VirtualRide').reduce((acc, run) => acc + (run.distance || 0), 0) / 1000).toFixed(1);
  const hikeRunDistance = (runs.filter(r => r.type === 'Run' || r.type === 'Hike').reduce((acc, run) => acc + (run.distance || 0), 0) / 1000).toFixed(1);

  // 3. 核心算法：计算最长连续运动天数 (Streak)
  let longestStreak = 0;
  if (runs.length > 0) {
    // 提取所有日期并去重排序 (从小到大)
    const dates = Array.from(new Set(runs.map(r => r.start_date_local.slice(0, 10))))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    longestStreak = 1;
    let currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      // 计算两个日期间隔天数
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));
      if (diffDays === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else if (diffDays > 1) {
        currentStreak = 1; // 断签了，重新计算
      }
    }
  }
  // --- 👆 计算结束 👆 ---
  const yearArray = Array.from(new Set(activities.map((a: Activity) => a.start_date_local.slice(0, 4))));
  yearArray.sort((a, b) => b.localeCompare(a)); 
  yearArray.push('Total');
  return (
    <Layout>
        <div className="pagetitle">
          2025 年检查出来二型糖尿病，经过饮食及运动结合，已减重二十多斤。但随着不运动及饮食的不控制，体重开始反弹～今年的目标体重 130-140斤。
        </div>
        <ul className="buttons">
          {yearArray.map((y) => (
            <li
              key={y}
              className={`button ${year === y ? 'selected' : ''}`}
              onClick={() => changeYear(y)}
            >
              {y}
            </li>
          ))}
        </ul>
        <div className="bento-hero">
          <div className="page-map bento-card-map">
          <RunMap
            title={title}
            viewState={viewState}
            geoData={geoData}
            setViewState={setViewState}
            changeYear={changeYear}
            thisYear={year}
          />
        </div>
        <div className="bento-dashboard">
          <div className="bento-card bento-primary">
            <div className="bento-value">{totalDistance}<span className="bento-unit">KM</span></div>
            <span className="bento-label">累计里程</span>
          </div>
          <div className="bento-card bento-sub">
             <div className="bento-data"><span className="bento-value-sm">{rideDistance}</span><span className="bento-unit-sm">KM</span></div>
             <span className="bento-label-sm">骑行</span>
          </div>
          <div className="bento-card bento-sub">
             <div className="bento-data"><span className="bento-value-sm">{hikeRunDistance}</span><span className="bento-unit-sm">KM</span></div>
             <span className="bento-label-sm">跑走</span>
          </div>
           <div className="bento-card bento-sub">
             <div className="bento-data"><span className="bento-value-sm">{activeDays}</span><span className="bento-unit-sm">天</span></div>
             <span className="bento-label-sm">出勤</span>
          </div>
           <div className="bento-card bento-sub">
             <div className="bento-data"><span className="bento-value-sm">{longestStreak}</span><span className="bento-unit-sm">天</span></div>
             <span className="bento-label-sm">最长连续</span>
          </div>
        </div>
        </div>
        <div className='page-nrong bento-card-table'>
          {year === 'Total' ? (
            <SVGStat />
          ) : (
            <RunTable
              runs={runs}
              locateActivity={locateActivity}
              setActivity={setActivity}
              runIndex={runIndex}
              setRunIndex={setRunIndex}
            />
          )}
        </div>
      <Analytics />
    </Layout>
  );
};

export default Index;
