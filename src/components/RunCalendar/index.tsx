import React, { useState, useMemo, useEffect } from 'react';
// 🌟 1. 引入 formatRunName 处理自定义名称
import { Activity, RunIds, colorFromType, formatRunName } from '@/utils/utils'; 
import styles from './style.module.scss';

interface IRunCalendarProps {
  runs: Activity[];
  locateActivity: (_runIds: RunIds) => void;
  runIndex: number;
  setRunIndex: (_index: number) => void;
  year: string; 
}

const RunCalendar = ({ runs, locateActivity, runIndex, setRunIndex, year }: IRunCalendarProps) => {
  const isTotal = year === 'Total';
  const displayYear = isTotal ? new Date().getFullYear() : Number(year);
  
  const [monthIndex, setMonthIndex] = useState<number>(new Date().getMonth());

  useEffect(() => {
    if (!isTotal && runs.length > 0) {
      setMonthIndex(new Date(runs[0].start_date_local).getMonth());
    }
  }, [runs, isTotal]);

  const globalStats = useMemo(() => {
    const totalDist = runs.reduce((sum, r) => sum + r.distance, 0) / 1000;
    const rideDist = runs.filter(r => r.type === 'Ride' || r.type === 'VirtualRide').reduce((sum, r) => sum + r.distance, 0) / 1000;
    const runDist = runs.filter(r => r.type === 'Run' || r.type === 'Hike').reduce((sum, r) => sum + r.distance, 0) / 1000;
    const datesSet = new Set(runs.map(r => r.start_date_local.slice(0, 10)));
    const activeDays = datesSet.size;

    let maxStreak = 0;
    if (datesSet.size > 0) {
      const dates = Array.from(datesSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      maxStreak = 1;
      let currStreak = 1;
      for (let i = 1; i < dates.length; i++) {
        const diffDays = Math.round((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) {
          currStreak++;
          maxStreak = Math.max(maxStreak, currStreak);
        } else if (diffDays > 1) {
          currStreak = 1;
        }
      }
    }
    return { totalDist, rideDist, runDist, activeDays, maxStreak };
  }, [runs]);

  const currentMonthRuns = useMemo(() => {
    if (isTotal) return [];
    return runs.filter(run => new Date(run.start_date_local).getMonth() === monthIndex);
  }, [runs, monthIndex, isTotal]);

  const monthDetailStats = useMemo(() => {
    const totalDist = currentMonthRuns.reduce((sum, r) => sum + r.distance, 0) / 1000;
    const rideDist = currentMonthRuns.filter(r => r.type === 'Ride' || r.type === 'VirtualRide').reduce((sum, r) => sum + r.distance, 0) / 1000;
    const runDist = currentMonthRuns.filter(r => r.type === 'Run' || r.type === 'Hike').reduce((sum, r) => sum + r.distance, 0) / 1000;
    return { totalDist, rideDist, runDist };
  }, [currentMonthRuns]);

  const runsByDate = useMemo(() => {
    const map = new Map<string, Activity[]>();
    currentMonthRuns.forEach(run => {
      const dateStr = run.start_date_local.slice(0, 10);
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(run);
    });
    return map;
  }, [currentMonthRuns]);

  const handlePrevMonth = () => setMonthIndex(prev => Math.max(0, prev - 1));
  const handleNextMonth = () => setMonthIndex(prev => Math.min(11, prev + 1));

  const firstDayOfMonth = new Date(displayYear, monthIndex, 1).getDay();
  const daysInMonth = new Date(displayYear, monthIndex + 1, 0).getDate();
  const days = Array.from({ length: firstDayOfMonth }, () => null)
    .concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  return (
    <div className={styles.boardContainer}>
      
      <div className={styles.globalSection}>
        <div className={styles.globalMainStat}>
          <span className={styles.val}>{globalStats.totalDist.toFixed(1)}</span>
          <span className={styles.unit}>KM</span>
        </div>
        <div className={styles.globalTitle}>{isTotal ? '生涯累计里程' : '累计里程'}</div>
        
        {/* 🌟 终极进化：专业级遥测数据底座 (左对齐无分割线) */}
        <div className={styles.metricsRow}>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>骑行</span>
            <span className={styles.metricValue}>{globalStats.rideDist.toFixed(0)}<small>km</small></span>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>跑走</span>
            <span className={styles.metricValue}>{globalStats.runDist.toFixed(0)}<small>km</small></span>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>出勤</span>
            <span className={styles.metricValue}>{globalStats.activeDays}<small>天</small></span>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>连签</span>
            <span className={styles.metricValue}>{globalStats.maxStreak}<small>天</small></span>
          </div>
        </div>
      </div>

      {isTotal ? (
        <div className={styles.totalPlaceholder}>
          <p>切换至具体年份<br/>查看月度运动日历</p>
        </div>
      ) : (
        <div className={styles.calendarSection}>
          <div className={styles.monthHeader}>
            <div className={styles.monthNav}>
              <button onClick={handlePrevMonth} disabled={monthIndex === 0}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              {/* 年月变得更紧凑高级 */}
              <span>{displayYear}-{String(monthIndex + 1).padStart(2, '0')}</span>
              <button onClick={handleNextMonth} disabled={monthIndex === 11}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>

          <div className={styles.weekdays}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          
          <div className={styles.grid}>
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className={styles.emptyDay} />;
              
              const dateStr = `${displayYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayRuns = runsByDate.get(dateStr) || [];
              const hasRun = dayRuns.length > 0;

              const sortedDayRuns = [...dayRuns].sort((a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime());
              const primaryRun = hasRun ? sortedDayRuns[0] : null;
              
              const runColor = primaryRun ? colorFromType(primaryRun.type) : '#32D74B';
              const isSelected = hasRun && runs[runIndex]?.run_id === primaryRun?.run_id;

              const tooltipText = hasRun 
                ? sortedDayRuns.map(r => `${formatRunName(r.name, r.start_date_local, r.type)}  ${(r.distance / 1000).toFixed(1)} km`).join('\n')
                : undefined;

              return (
                <div
                  key={day}
                  data-tooltip={tooltipText} 
                  className={`${styles.dayCell} ${hasRun ? styles.hasRun : ''} ${isSelected ? styles.selected : ''}`}
                  onClick={() => {
                    if (hasRun && primaryRun) {
                      if (isSelected) {
                        locateActivity([]);
                        setRunIndex(-1);
                      } else {
                        locateActivity([primaryRun.run_id]);
                        setRunIndex(runs.findIndex(r => r.run_id === primaryRun.run_id));
                      }
                    }
                  }}
                  style={{ 
                    backgroundColor: isSelected ? `${runColor}26` : undefined,
                    boxShadow: isSelected ? `inset 0 0 0 1px ${runColor}` : undefined 
                  }}
                >
                  <span 
                    className={styles.dateNum} 
                    style={{ 
                      color: hasRun ? runColor : 'inherit',
                      opacity: hasRun ? 1 : 0.3,
                      fontWeight: hasRun ? 800 : 500,
                      textShadow: hasRun ? `0 0 8px ${runColor}40` : 'none'
                    }}
                  >
                    {day}
                  </span>
                  
                  {sortedDayRuns.length > 1 && (
                    <div className={styles.dotsRow}>
                      {sortedDayRuns.map((r, i) => (
                        <span 
                          key={i} 
                          className={styles.tinyDot} 
                          style={{ backgroundColor: colorFromType(r.type) }}
                        />
                      ))}
                    </div>
                  )}
                  
                </div>
              );
            })}
          </div>

          <div className={styles.monthFooter}>
            本月里程 <span>{monthDetailStats.totalDist.toFixed(1)}</span> km 
            <span className={styles.dot}>•</span> 
            骑行 <span>{monthDetailStats.rideDist.toFixed(1)}</span> km 
            <span className={styles.dot}>•</span> 
            跑走 <span>{monthDetailStats.runDist.toFixed(1)}</span> km
          </div>
        </div>
      )}
    </div>
  );
};

export default RunCalendar;