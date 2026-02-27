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
      const exactTime = new Date(r.start_date_local).getTime();

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
  // 🌟 1. 计算 Sparkline 基础数据 (引入高斯平滑算法，绝对丝滑)
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
      // 52 周数据
      const weekData = new Array(52).fill(0);
      normalizedRuns.forEach(r => {
        const firstDay = new Date(displayYear, 0, 1).getTime();
        const diffDays = Math.floor((r.exactTime - firstDay) / 86400000);
        const week = Math.max(0, Math.min(51, Math.floor(diffDays / 7)));
        weekData[week] += r.distance;
      });
      rawData = weekData;
    }

    // 🌟 核心魔法：1D 卷积平滑 (Moving Average Smoothing)
    const smoothedData = rawData.map((val, idx, arr) => {
      const prev = arr[idx - 1] !== undefined ? arr[idx - 1] : val;
      const next = arr[idx + 1] !== undefined ? arr[idx + 1] : val;
      // 权重分配：当前周占 50%，前后各占 25%
      return prev * 0.25 + val * 0.5 + next * 0.25;
    });

    return smoothedData;
  }, [normalizedRuns, isTotal, displayYear]);

  // 🌟 2. 生成平滑曲线 (数学逻辑最清晰的完整版，拒绝压缩)
  const sparklinePath = useMemo(() => {
    if (sparklineData.length === 0) return '';
    
    const width = 200;
    const height = 40;
    const pad = 4; // 🌟 底部保护间距
    
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
      
      // 🌟 核心修复：强制限制控制点，完美防溢出
      cp1y = Math.max(pad, Math.min(height - pad, cp1y));
      cp2y = Math.max(pad, Math.min(height - pad, cp2y));
      
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  }, [sparklineData]);
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

  // 🌟 翻页时记录方向
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
      <div className={styles.globalSection}>
        {sparklinePath && (
          <svg key={year} className={styles.sparkline} viewBox="0 0 200 40" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#32D74B" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#32D74B" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* 渐变填充区域 */}
            <path 
              d={`${sparklinePath} L 200,40 L 0,40 Z`} 
              fill="url(#sparklineGrad)" 
              stroke="none" 
              className={styles.sparklineFill}
            />
            {/* 纯净发光线条 */}
            <path 
              d={sparklinePath} 
              fill="none" 
              className={styles.sparklineLine} 
            />
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
              <button onClick={handlePrevMonth} disabled={monthIndex === 0}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <span>{displayYear}-{String(monthIndex + 1).padStart(2, '0')}</span>
              <button onClick={handleNextMonth} disabled={monthIndex === 11}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>

          <div className={styles.weekdays}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          
          {/* 🌟 核心魔法：使用 key 强制 React 重绘 DOM，配合 data-direction 传递给 CSS */}
          <div 
            key={`${displayYear}-${monthIndex}`} 
            className={styles.grid}
            data-direction={direction}
          >
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className={styles.emptyDay} />;
              
              const dateStr = `${displayYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayRuns = runsByDate.get(dateStr) || [];
              const hasRun = dayRuns.length > 0;
              const primaryRun = hasRun ? dayRuns[0] : null;
              
              const runColor = primaryRun ? colorFromType(primaryRun.type) : '#32D74B';
              const isSelected = hasRun && runs[runIndex]?.run_id === primaryRun?.run_id;

              const tooltipText = hasRun 
                ? dayRuns.map(r => `${formatRunName(r.name, r.start_date_local, r.type)}  ${(r.distance / 1000).toFixed(1)} km`).join('\n')
                : undefined;

              return (
                <div
                  key={dateStr}
                  data-tooltip={tooltipText} 
                  className={`${styles.dayCell} ${hasRun ? styles.hasRun : ''} ${isSelected ? styles.selected : ''}`}
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
                  
                  {dayRuns.length > 1 && (
                    <div className={styles.dotsRow}>
                      {dayRuns.map((r, i) => (
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