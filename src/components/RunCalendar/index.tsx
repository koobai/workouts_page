import React, { useState, useMemo, useEffect } from 'react';
import { Activity, RunIds, colorFromType, formatRunName } from '@/utils/utils'; 
import styles from './style.module.scss';

interface IRunCalendarProps {
  runs: Activity[];
  locateActivity: (_runIds: RunIds) => void;
  runIndex: number;
  setRunIndex: (_index: number) => void;
  year: string; 
}

const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'EBikeRide']);
const RUN_TYPES = new Set(['Run', 'Hike', 'TrailRun', 'Walk']);

const RunCalendar = ({ runs, locateActivity, runIndex, setRunIndex, year }: IRunCalendarProps) => {
  const isTotal = year === 'Total';
  const displayYear = isTotal ? new Date().getFullYear() : Number(year);

  const { normalizedRuns, runIdIndexMap } = useMemo(() => {
    const indexMap = new Map<number, number>();
    const normRuns = runs.map((r, i) => {
      indexMap.set(r.run_id, i); 
      
      const dateStr = r.start_date_local.slice(0, 10);
      const month = Number(dateStr.slice(5, 7)) - 1; 
      
      const utcDayTimestamp = new Date(`${dateStr}T00:00:00Z`).getTime();
      // 🌟 优化 1：修复 Safari 浏览器下日期解析返回 NaN 的致命兼容性 Bug
      const exactTime = new Date(r.start_date_local.replace(' ', 'T')).getTime();

      return { ...r, dateStr, month, utcDayTimestamp, exactTime };
    });
    return { normalizedRuns: normRuns, runIdIndexMap: indexMap };
  }, [runs]);

  const [monthIndex, setMonthIndex] = useState<number>(new Date().getMonth());
  const [direction, setDirection] = useState<number>(0);

  useEffect(() => {
    if (!isTotal && normalizedRuns.length > 0) {
      setMonthIndex(normalizedRuns[0].month);
      setDirection(0);
    }
  }, [normalizedRuns, isTotal]);

  const globalStats = useMemo(() => {
    let totalDist = 0, rideDist = 0, runDist = 0;
    const datesSet = new Set<number>(); 

    normalizedRuns.forEach(r => {
      totalDist += r.distance;
      if (RIDE_TYPES.has(r.type)) rideDist += r.distance;
      else if (RUN_TYPES.has(r.type)) runDist += r.distance;
      datesSet.add(r.utcDayTimestamp);
    });

    const activeDays = datesSet.size;
    let maxStreak = 0;

    if (activeDays > 0) {
      const timestamps = Array.from(datesSet).sort((a, b) => a - b);
      maxStreak = 1;
      let currStreak = 1;
      for (let i = 1; i < timestamps.length; i++) {
        const diffDays = (timestamps[i] - timestamps[i - 1]) / 86400000;
        if (diffDays === 1) {
          currStreak++;
          maxStreak = Math.max(maxStreak, currStreak);
        } else if (diffDays > 1) {
          currStreak = 1;
        }
      }
    }
    return { 
      totalDist: totalDist / 1000, 
      rideDist: rideDist / 1000, 
      runDist: runDist / 1000, 
      activeDays, 
      maxStreak 
    };
  }, [normalizedRuns]);

  const sparklineData = useMemo(() => {
    let rawData: number[] = [];
    
    if (isTotal) {
      const yearMap = new Map<number, number>();
      normalizedRuns.forEach(r => {
        const y = Number(r.dateStr.slice(0, 4));
        yearMap.set(y, (yearMap.get(y) || 0) + r.distance);
      });
      if (yearMap.size === 0) return [];
      const minYear = Math.min(...yearMap.keys());
      const maxYear = Math.max(...yearMap.keys());
      for (let y = minYear; y <= maxYear; y++) {
        rawData.push(yearMap.get(y) || 0);
      }
    } else {
      const weekData = new Array(52).fill(0);
      normalizedRuns.forEach(r => {
        const firstDay = new Date(displayYear, 0, 1).getTime();
        const diffDays = Math.floor((r.exactTime - firstDay) / 86400000);
        const week = Math.max(0, Math.min(51, Math.floor(diffDays / 7)));
        weekData[week] += r.distance;
      });
      rawData = weekData;
    }

    const smoothedData = rawData.map((val, idx, arr) => {
      const prev = arr[idx - 1] !== undefined ? arr[idx - 1] : val;
      const next = arr[idx + 1] !== undefined ? arr[idx + 1] : val;
      return prev * 0.25 + val * 0.5 + next * 0.25;
    });

    return smoothedData;
  }, [normalizedRuns, isTotal, displayYear]);

  const sparklinePath = useMemo(() => {
    if (sparklineData.length === 0) return '';
    
    const width = 200;
    const height = 40;
    const pad = 4; 
    
    const max = Math.max(...sparklineData, 1); 
    const points = sparklineData.map((d, i) => ({
      x: (i / (sparklineData.length - 1 || 1)) * width,
      y: height - pad - (d / max) * (height - 2 * pad)
    }));

    if (points.length === 1) {
      return `M 0,${points[0].y} L ${width},${points[0].y}`;
    }

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
      
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      let cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      let cp2y = p2.y - (p3.y - p1.y) / 6;
      
      cp1y = Math.max(pad, Math.min(height - pad, cp1y));
      cp2y = Math.max(pad, Math.min(height - pad, cp2y));
      
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  }, [sparklineData]);

  const { yearlyMaxDate, monthlyMaxDates } = useMemo(() => {
    if (isTotal || normalizedRuns.length === 0) {
      return { yearlyMaxDate: '', monthlyMaxDates: new Map<number, string>() };
    }

    const distMap = new Map<string, number>();

    normalizedRuns.forEach(r => {
      distMap.set(r.dateStr, (distMap.get(r.dateStr) || 0) + r.distance);
    });

    let yMax = 0;
    let yDate = '';
    const mMax = new Map<number, number>();
    const mDate = new Map<number, string>();

    distMap.forEach((dist, dateStr) => {
      const year = dateStr.slice(0, 4);
      const month = Number(dateStr.slice(5, 7)) - 1;

      if (dist > yMax) {
        yMax = dist;
        yDate = dateStr;
      }
      
      if (dist > (mMax.get(month) || 0)) {
        mMax.set(month, dist);
        mDate.set(month, dateStr);
      }
    });

    return { yearlyMaxDate: yDate, monthlyMaxDates: mDate };
  }, [normalizedRuns, isTotal]);

  const { runsByDate, monthDetailStats } = useMemo(() => {
    const map = new Map<string, typeof normalizedRuns>();
    let total = 0, ride = 0, run = 0;

    if (!isTotal) {
      normalizedRuns.forEach(r => {
        if (r.month === monthIndex) {
          if (!map.has(r.dateStr)) map.set(r.dateStr, []);
          map.get(r.dateStr)!.push(r);
          
          total += r.distance;
          if (RIDE_TYPES.has(r.type)) ride += r.distance;
          else if (RUN_TYPES.has(r.type)) run += r.distance;
        }
      });

      map.forEach(dayRuns => {
        if (dayRuns.length > 1) {
          dayRuns.sort((a, b) => b.exactTime - a.exactTime);
        }
      });
    }

    return {
      runsByDate: map,
      monthDetailStats: { totalDist: total / 1000, rideDist: ride / 1000, runDist: run / 1000 }
    };
  }, [normalizedRuns, monthIndex, isTotal]);

  const handlePrevMonth = () => {
    setDirection(-1);
    setMonthIndex(prev => Math.max(0, prev - 1));
  };
  const handleNextMonth = () => {
    setDirection(1);
    setMonthIndex(prev => Math.min(11, prev + 1));
  };

  const firstDayOfMonth = new Date(displayYear, monthIndex, 1).getDay();
  const daysInMonth = new Date(displayYear, monthIndex + 1, 0).getDate();
  const days = Array.from({ length: firstDayOfMonth }, () => null)
    .concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  return (
    <div className={styles.boardContainer}>
      
      {/* 🌟 优化 2：全局集中定义 SVG 渐变，彻底避免 ID 冲突与重复渲染消耗 */}
      <svg style={{ width: 0, height: 0, position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64D2FF" />
            <stop offset="100%" stopColor="#0A84FF" />
          </linearGradient>
        </defs>
      </svg>

      <div className={styles.globalSection}>
        {sparklinePath && (
          <svg key={year} className={styles.sparkline} viewBox="0 0 200 40" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#32D74B" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#32D74B" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${sparklinePath} L 200,40 L 0,40 Z`} fill="url(#sparklineGrad)" stroke="none" className={styles.sparklineFill} />
            <path d={sparklinePath} fill="none" className={styles.sparklineLine} />
          </svg>
        )}
        <div className={styles.globalMainStat}>
          <span className={styles.val}>{globalStats.totalDist.toFixed(1)}</span>
          <span className={styles.unit}>KM</span>
        </div>
        <div className={styles.globalTitle}>{isTotal ? '生涯累计里程' : '累计里程'}</div>
        
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
              <button onClick={handlePrevMonth} disabled={monthIndex === 0} title="上个月">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <span>{displayYear}-{String(monthIndex + 1).padStart(2, '0')}</span>
              <button onClick={handleNextMonth} disabled={monthIndex === 11} title="下个月">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>

          <div className={styles.weekdays}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          
          <div key={`${displayYear}-${monthIndex}`} className={styles.grid} data-direction={direction}>
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className={styles.emptyDay} />;
              
              const dateStr = `${displayYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayRuns = runsByDate.get(dateStr) || [];
              const hasRun = dayRuns.length > 0;
              const primaryRun = hasRun ? dayRuns[0] : null;
              
              const runColor = primaryRun ? colorFromType(primaryRun.type) : '#32D74B';
              const isSelected = hasRun && runs[runIndex]?.run_id === primaryRun?.run_id;

              const isYearlyMax = dateStr === yearlyMaxDate;
              const isMonthlyMax = !isYearlyMax && dateStr === monthlyMaxDates.get(monthIndex);
              const isMaxDay = isYearlyMax || isMonthlyMax;

              return (
                <div
                  key={dateStr}
                  className={`${styles.dayCell} ${hasRun ? styles.hasRun : ''} ${isSelected ? styles.selected : ''} ${isMaxDay ? styles.maxDay : ''}`}
                  onClick={() => {
                    if (hasRun && primaryRun) {
                      if (isSelected) {
                        locateActivity([]);
                        setRunIndex(-1);
                      } else {
                        locateActivity([primaryRun.run_id]);
                        setRunIndex(runIdIndexMap.get(primaryRun.run_id) ?? -1);
                      }
                    }
                  }}
                  style={{ 
                    backgroundColor: (isSelected && !isMaxDay) ? `${runColor}26` : undefined,
                    boxShadow: (isSelected && !isMaxDay) ? `inset 0 0 0 1px ${runColor}` : undefined 
                  }}
                >
                  {hasRun && (
                    <div className={styles.runTooltip}>
                      <div className={styles.ttList}>
                        {dayRuns.map((r) => (
                          /* 🌟 优化 3：采用唯一 run_id 作为 key，提升 React 渲染性能 */
                          <div key={r.run_id} className={styles.ttItem}>
                            <span className={styles.ttName} style={{ color: colorFromType(r.type) }}>
                              {formatRunName(r.name, r.start_date_local, r.type)}
                            </span>
                            <span className={styles.ttVal}>{(r.distance / 1000).toFixed(1)} <small>km</small></span>
                          </div>
                        ))}
                      </div>
                      
                      {isMaxDay && (
                        <div className={styles.ttAchievement} style={{ color: isYearlyMax ? '#FFD700' : '#64D2FF' }}>
                          <span>{isYearlyMax ? '年度最高' : '月度最高'}</span>
                          <span className={styles.ttVal}>
                            {(dayRuns.reduce((sum, r) => sum + r.distance, 0) / 1000).toFixed(1)} <small>km</small>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {isMaxDay ? (
                    isYearlyMax ? (
                      <svg className={styles.yearlyBadge} viewBox="0 0 36 36" fill="currentColor">
                        <circle cx="18" cy="18" r="16" fill="url(#goldGrad)" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#FFF" strokeWidth="0.8" opacity="0.4" />
                        <path d="M18 8L20.4 12.8L25.8 13.6L22 17.5L22.9 22.9L18 20.5L13.1 22.9L14 17.5L10.2 13.6L15.6 12.8L18 8Z" fill="#FFF" />
                      </svg>
                    ) : (
                      <svg className={styles.monthlyBadge} viewBox="0 0 36 36" fill="currentColor">
                        <circle cx="18" cy="18" r="16" fill="url(#blueGrad)" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#FFF" strokeWidth="0.8" opacity="0.4" />
                        <path d="M18 8L20.4 12.8L25.8 13.6L22 17.5L22.9 22.9L18 20.5L13.1 22.9L14 17.5L10.2 13.6L15.6 12.8L18 8Z" fill="#FFF" />
                      </svg>
                    )
                  ) : (
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
                  )}
                  
                  {!isMaxDay && dayRuns.length > 1 && (
                    <div className={styles.dotsRow}>
                      {dayRuns.map((r) => (
                        <span 
                          key={r.run_id} 
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