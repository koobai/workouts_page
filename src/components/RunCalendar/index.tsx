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

// 🌟 优化 5：使用 Set 替代 || 判断，扩展性与性能双收
const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'EBikeRide']);
const RUN_TYPES = new Set(['Run', 'Hike', 'TrailRun', 'Walk']);

const RunCalendar = ({ runs, locateActivity, runIndex, setRunIndex, year }: IRunCalendarProps) => {
  const isTotal = year === 'Total';
  const displayYear = isTotal ? new Date().getFullYear() : Number(year);

  // 🌟 优化 1 & 4：在最外层执行一次性 O(n) 数据预处理，彻底消灭下游所有的 new Date() 和 findIndex()
  const { normalizedRuns, runIdIndexMap } = useMemo(() => {
    const indexMap = new Map<number, number>();
    const normRuns = runs.map((r, i) => {
      indexMap.set(r.run_id, i); // 建立 O(1) 的索引哈希表
      
      const dateStr = r.start_date_local.slice(0, 10);
      const month = Number(dateStr.slice(5, 7)) - 1; // 0-11
      
      // 🌟 优化 2：强制使用 UTC 午夜时间戳，彻底免疫所有时区和夏令时差异！
      const utcDayTimestamp = new Date(`${dateStr}T00:00:00Z`).getTime();
      // 精确时间戳，留给同一天多次运动排序用
      const exactTime = new Date(r.start_date_local).getTime();

      return { ...r, dateStr, month, utcDayTimestamp, exactTime };
    });
    return { normalizedRuns: normRuns, runIdIndexMap: indexMap };
  }, [runs]);

  const [monthIndex, setMonthIndex] = useState<number>(new Date().getMonth());

  useEffect(() => {
    if (!isTotal && normalizedRuns.length > 0) {
      setMonthIndex(normalizedRuns[0].month);
    }
  }, [normalizedRuns, isTotal]);

  const globalStats = useMemo(() => {
    let totalDist = 0, rideDist = 0, runDist = 0;
    const datesSet = new Set<number>(); // 存 utcDayTimestamp

    normalizedRuns.forEach(r => {
      totalDist += r.distance;
      if (RIDE_TYPES.has(r.type)) rideDist += r.distance;
      else if (RUN_TYPES.has(r.type)) runDist += r.distance;
      datesSet.add(r.utcDayTimestamp);
    });

    const activeDays = datesSet.size;
    let maxStreak = 0;

    if (activeDays > 0) {
      // 🌟 优化 2：直接整数天数相减，无浮点误差，极其稳定
      const timestamps = Array.from(datesSet).sort((a, b) => a - b);
      maxStreak = 1;
      let currStreak = 1;
      for (let i = 1; i < timestamps.length; i++) {
        // 86400000 是精确的一天的毫秒数，因为全是 UTC 午夜，除出来绝对是完美整数
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

  // 🌟 优化 6：真正的大杀器！一次 O(n) 遍历同时完成：当月数据筛选、按天哈希分组、当月里程统计
  const { runsByDate, monthDetailStats } = useMemo(() => {
    const map = new Map<string, typeof normalizedRuns>();
    let total = 0, ride = 0, run = 0;

    if (!isTotal) {
      normalizedRuns.forEach(r => {
        if (r.month === monthIndex) {
          // 1. 构建日历渲染所需的字典树
          if (!map.has(r.dateStr)) map.set(r.dateStr, []);
          map.get(r.dateStr)!.push(r);
          
          // 2. 顺手统计当月数据
          total += r.distance;
          if (RIDE_TYPES.has(r.type)) ride += r.distance;
          else if (RUN_TYPES.has(r.type)) run += r.distance;
        }
      });

      // 3. 将每天内部的数据按具体时间倒序排好（由于数据量极小，性能损耗可忽略）
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
          
          <div className={styles.grid}>
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className={styles.emptyDay} />;
              
              const dateStr = `${displayYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              // 直接 O(1) 获取预先整理好的当天数据
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
                  // 🌟 优化 3：抛弃 key={day}，使用绝对唯一的 dateStr，彻底消灭重渲染或动画复用隐患
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
                        // 🌟 优化 4：告别每次点击都去遍历几千条数据的 O(n) findIndex
                        // 直接从预置的 Map 里 O(1) 取出原始索引！
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