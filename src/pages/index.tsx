import { useEffect, useState, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Layout from '@/components/Layout';
import RunMap from '@/components/RunMap';
import RunTable from '@/components/RunTable';
import SVGStat from '@/components/SVGStat';
import useActivities from '@/hooks/useActivities';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import RunCalendar from '@/components/RunCalendar';
import {
  Activity,
  IViewState,
  filterAndSortRuns,
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
  const bounds = getBoundsForGeoData(geoData);

  const intervalRef = useRef<number>();

  const [viewState, setViewState] = useState<IViewState>({
    ...bounds,
  });

  const bentoRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  // 滚动吸顶 + rAF 性能节流
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (bentoRef.current) {
            const rect = bentoRef.current.getBoundingClientRect();
            setIsSticky(rect.bottom < 80);
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 🌟 拨乱反正：恢复最稳健的重绘策略！
  // 因为地图吸顶有 0.4s 的 CSS 动画，所以必须用 setTimeout 在不同阶段强制 Mapbox 刷新，解决右侧留白。
  useEffect(() => {
    // 1. 状态改变瞬间触发
    window.dispatchEvent(new Event('resize'));
    
    // 2. 动画初期触发
    const timer1 = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);

    // 3. 动画中后期/年份切换 DOM 挂载完毕后触发兜底
    const timer2 = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 250);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isSticky, year]); // 严格监听吸顶状态和年份变化

  const changeByItem = (
    item: string,
    name: string,
    func: (_run: Activity, _value: string) => boolean
  ) => {
    if (!isSticky) scrollToMap();
    
    if (name != 'Year') {
      setYear(thisYear);
    }
    setActivity(filterAndSortRuns(activities, item, func, sortDateFunc));
    setRunIndex(-1);
    setTitle(`${item} ${name} Heatmap`);
  };

  const changeYear = (y: string) => {
    setYear(y);

    if ((viewState.zoom ?? 0) > 3 && bounds) {
      setViewState({ ...bounds });
    }

    changeByItem(y, 'Year', filterYearRuns);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
  };

  const locateActivity = (runIds: RunIds) => {
    const ids = new Set(runIds);
    const selectedRuns = !runIds.length
      ? runs
      : runs.filter((r: any) => ids.has(r.run_id));

    if (!selectedRuns.length) return;

    const lastRun = selectedRuns.reduce((acc: Activity, curr: Activity) => 
      sortDateFunc(acc, curr) <= 0 ? acc : curr
    );

    if (!lastRun) return;

    setGeoData(geoJsonForRuns(selectedRuns));
    setTitle(titleForShow(lastRun));
    
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    
    if (!isSticky) scrollToMap();
  };

  useEffect(() => {
    setViewState({ ...bounds });
  }, [geoData]);

  useEffect(() => {
    const runsNum = runs.length;
    const sliceNum = runsNum >= 10 ? runsNum / 10 : 1;
    let i = sliceNum;
    
    const id = window.setInterval(() => {
      if (i >= runsNum) {
        window.clearInterval(id);
      }
      const tempRuns = runs.slice(0, i);
      setGeoData(geoJsonForRuns(tempRuns));
      i += sliceNum;
    }, 10);
    
    intervalRef.current = id;

    return () => window.clearInterval(id);
  }, [runs]);

  useEffect(() => {
    if (year !== 'Total') return;

    let svgStat = document.getElementById('svgStat');
    if (!svgStat) return;

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'path') {
        const descEl = target.querySelector('desc');
        if (descEl) {
          const runId = Number(descEl.innerHTML);
          if (!runId) return;
          locateActivity([runId]);
          return;
        }

        const titleEl = target.querySelector('title');
        if (titleEl) {
          const [runDate] = titleEl.innerHTML.match(/\d{4}-\d{1,2}-\d{1,2}/) || [
            `${+thisYear + 1}`,
          ];
          const runIDsOnDate = runs
            .filter((r) => r.start_date_local.slice(0, 10) === runDate)
            .map((r) => r.run_id);
          if (!runIDsOnDate.length) return;
          locateActivity(runIDsOnDate);
        }
      }
    }
    svgStat.addEventListener('click', handleClick);
    return () => {
      svgStat && svgStat.removeEventListener('click', handleClick);
    };
  }, [year]);
  
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
        
        <div className="bento-hero" ref={bentoRef}>
          
          <div className="bento-map-placeholder">
            <div className={`page-map bento-card-map ${isSticky ? 'sticky-map' : ''}`}>
              <RunMap
                title={title}
                viewState={viewState}
                geoData={geoData}
                setViewState={setViewState}
                changeYear={changeYear}
                thisYear={year}
              />
            </div>
          </div>

          <div className="bento-calendar-board">
            <RunCalendar
              runs={runs}
              locateActivity={locateActivity}
              runIndex={runIndex}
              setRunIndex={setRunIndex}
              year={year} 
            />
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