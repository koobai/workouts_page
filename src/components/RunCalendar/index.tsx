import React, { useState, useMemo, useEffect, useRef } from 'react';
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

function useRunDataEngine(runs: Activity[], year: string, monthIndex: number) {
  const displayYear = Number(year);

  const { normalizedRuns, runIdIndexMap, runsByMonth } = useMemo(() => {
    const indexMap = new Map<number, number>();
    const monthMap = new Map<number, { runs: any[], runsByDate: Map<string, any[]> }>();
    
    const normRuns = runs.map((r, i) => {
      indexMap.set(r.run_id, i);
      const dateStr = r.start_date_local.slice(0, 10);
      const month = Number(dateStr.slice(5, 7)) - 1;
      const cleanDateString = r.start_date_local.replace(' ', 'T');
      
      const utcDayTimestamp = new Date(`${dateStr}T00:00:00Z`).getTime();
      const exactTime = new Date(cleanDateString).getTime();
      const hour = new Date(cleanDateString).getHours(); 
      
      return { ...r, dateStr, month, utcDayTimestamp, exactTime, hour };
    });

    normRuns.forEach(r => {
      if (!monthMap.has(r.month)) {
        monthMap.set(r.month, { runs: [], runsByDate: new Map() });
      }
      const m = monthMap.get(r.month)!;
      m.runs.push(r);
      if (!m.runsByDate.has(r.dateStr)) m.runsByDate.set(r.dateStr, []);
      m.runsByDate.get(r.dateStr)!.push(r);
    });

    return { normalizedRuns: normRuns, runIdIndexMap: indexMap, runsByMonth: monthMap };
  }, [runs]);

  const globalData = useMemo(() => {
    let totalDist = 0, rideDist = 0, runDist = 0;
    const datesSet = new Set<number>();
    
    const firstDayUTC = Date.UTC(displayYear, 0, 1);
    const lastDayUTC = Date.UTC(displayYear, 11, 31);
    const totalWeeks = Math.ceil((lastDayUTC - firstDayUTC) / 86400000 / 7) + 1;
    const weekData = new Array(totalWeeks).fill(0);
    const distMap = new Map<string, number>();

    normalizedRuns.forEach(r => {
      totalDist += r.distance;
      if (RIDE_TYPES.has(r.type)) rideDist += r.distance;
      else if (RUN_TYPES.has(r.type)) runDist += r.distance;
      datesSet.add(r.utcDayTimestamp);

      const diffDays = Math.floor((r.utcDayTimestamp - firstDayUTC) / 86400000);
      const week = Math.max(0, Math.min(totalWeeks - 1, Math.floor(diffDays / 7)));
      weekData[week] += r.distance;
      distMap.set(r.dateStr, (distMap.get(r.dateStr) || 0) + r.distance);
    });

    const activeDays = datesSet.size;
    let maxStreak = 0;
    if (activeDays > 0) {
      const timestamps = Array.from(datesSet).sort((a, b) => a - b);
      maxStreak = 1; let currStreak = 1;
      for (let i = 1; i < timestamps.length; i++) {
        const diffDays = (timestamps[i] - timestamps[i - 1]) / 86400000;
        if (diffDays === 1) { currStreak++; maxStreak = Math.max(maxStreak, currStreak); } 
        else if (diffDays > 1) { currStreak = 1; }
      }
    }

    const sparklineData = weekData.map((val, idx, arr) => {
      const prev = arr[idx - 1] !== undefined ? arr[idx - 1] : val;
      const next = arr[idx + 1] !== undefined ? arr[idx + 1] : val;
      return prev * 0.25 + val * 0.5 + next * 0.25;
    });

    const sparklineMax = Math.max(...sparklineData, 1);

    let yMax = 0, yDate = '';
    const mMax = new Map<number, number>(), mDate = new Map<number, string>();
    distMap.forEach((dist, dateStr) => {
      const month = Number(dateStr.slice(5, 7)) - 1;
      if (dist > yMax) { yMax = dist; yDate = dateStr; }
      if (dist > (mMax.get(month) || 0)) { mMax.set(month, dist); mDate.set(month, dateStr); }
    });

    return {
      stats: { totalDist: totalDist / 1000, rideDist: rideDist / 1000, runDist: runDist / 1000, activeDays, maxStreak },
      sparklineData,
      sparklineMax,
      yearlyMaxDate: yDate,
      monthlyMaxDates: mDate
    };
  }, [normalizedRuns, displayYear]);

  const monthlyData = useMemo(() => {
    const monthData = runsByMonth.get(monthIndex) || { runs: [], runsByDate: new Map() };
    const { runs: currentRuns, runsByDate: runsMap } = monthData;
    
    let mTotal = 0, mRide = 0, mRun = 0; 
    const timeBlocks = new Array(8).fill(0);
    const hrCounts = new Array(5).fill(0);
    let validHrRuns = 0;
    let maxTimeBlockCount = 0;

    currentRuns.forEach(r => {
      mTotal += r.distance;
      
      if (RIDE_TYPES.has(r.type)) {
        mRide += r.distance; 
      } else if (r.type === 'Walk' || RUN_TYPES.has(r.type)) {
        mRun += r.distance; 
      }

      const blockIndex = Math.floor(r.hour / 3);
      timeBlocks[blockIndex]++;
      if (timeBlocks[blockIndex] > maxTimeBlockCount) maxTimeBlockCount = timeBlocks[blockIndex];

      const hr = r.average_heartrate;
      if (hr && hr > 0) {
        validHrRuns++;
        if (hr < 115) hrCounts[0]++; else if (hr < 130) hrCounts[1]++;
        else if (hr < 145) hrCounts[2]++; else if (hr < 160) hrCounts[3]++;
        else hrCounts[4]++;
      }
    });

    runsMap.forEach(dayRuns => { if (dayRuns.length > 1) dayRuns.sort((a, b) => b.exactTime - a.exactTime); });

    const personas = [
      { name: '午夜潜行', time: '00:00-03:00' }, { name: '破晓先锋', time: '03:00-06:00' },
      { name: '晨光逐风', time: '06:00-09:00' }, { name: '骄阳行者', time: '09:00-12:00' },
      { name: '烈日独行', time: '12:00-15:00' }, { name: '午后追风', time: '15:00-18:00' },
      { name: '暮色掠影', time: '18:00-21:00' }, { name: '暗夜游侠', time: '21:00-24:00' }
    ];
    let peakPersona = '等待记录';
    if (maxTimeBlockCount > 0) peakPersona = personas[timeBlocks.indexOf(maxTimeBlockCount)].name;

    const hrMaxIndex = hrCounts.indexOf(Math.max(...hrCounts));
    const hrZonesInfo = [
      { color: '#99FF00', title: '舒缓有氧', name: 'Z1', range: '<115' },
      { color: '#FFFF00', title: '稳态燃脂', name: 'Z2', range: '115-129' },
      { color: '#FF9900', title: '有氧强化', name: 'Z3', range: '130-144' },
      { color: '#FF3300', title: '乳酸阈值', name: 'Z4', range: '145-159' },
      { color: '#FF0000', title: '无氧极限', name: 'Z5', range: '≥160' },
    ];

    return {
      runsByDate: runsMap,
      monthDetailStats: { totalDist: mTotal / 1000, rideDist: mRide / 1000, runDist: mRun / 1000 },
      insights: {
        hasActivities: currentRuns.length > 0, timeBlocks, maxTimeBlockCount: Math.max(maxTimeBlockCount, 1),
        peakPersona, personas, validHrRuns, hrCounts, hrZonesInfo, hrMaxZone: hrZonesInfo[hrMaxIndex]
      }
    };
  }, [runsByMonth, monthIndex]);

  return { displayYear, normalizedRuns, runIdIndexMap, globalData, monthlyData };
}

const RunCalendar = ({ runs, locateActivity, runIndex, setRunIndex, year }: IRunCalendarProps) => {
  const [monthIndex, setMonthIndex] = useState<number>(new Date().getMonth());
  const [direction, setDirection] = useState<number>(0);
  
  const [animatedDist, setAnimatedDist] = useState(0);
  const prevDistRef = useRef(0);

  const engine = useRunDataEngine(runs, year, monthIndex);

  useEffect(() => {
    if (engine.normalizedRuns.length > 0) {
      setMonthIndex(engine.normalizedRuns[0].month);
      setDirection(0);
    }
  }, [engine.normalizedRuns]);

  useEffect(() => {
    const targetDist = engine.globalData.stats.totalDist;
    const startDist = prevDistRef.current; 
    
    if (targetDist === startDist) {
      setAnimatedDist(targetDist);
      return;
    }

    let startTime: number;
    let animationFrameId: number;
    const duration = 1000; 

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = time - startTime;
      const percent = Math.min(progress / duration, 1);
      
      const easeOut = 1 - Math.pow(1 - percent, 4); 

      setAnimatedDist(startDist + (targetDist - startDist) * easeOut);

      if (progress < duration) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setAnimatedDist(targetDist); 
        prevDistRef.current = targetDist; 
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [engine.globalData.stats.totalDist]);

  const sparklinePath = useMemo(() => {
    const data = engine.globalData.sparklineData;
    if (data.length === 0) return '';
    const width = 200, height = 40, pad = 6;
    const max = engine.globalData.sparklineMax; 
    
    const points = data.map((d, i) => ({
      x: (i / (data.length - 1 || 1)) * width,
      y: height - pad - (d / max) * (height - 2 * pad)
    }));
    if (points.length === 1) return `M 0,${points[0].y} L ${width},${points[0].y}`;

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2 < points.length ? i + 2 : i + 1];
      const cp1x = p1.x + (p2.x - p0.x) / 6, cp2x = p2.x - (p3.x - p1.x) / 6;
      let cp1y = p1.y + (p2.y - p0.y) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
      cp1y = Math.max(pad, Math.min(height - pad, cp1y));
      cp2y = Math.max(pad, Math.min(height - pad, cp2y));
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  }, [engine.globalData.sparklineData, engine.globalData.sparklineMax]); 

  const handlePrevMonth = () => { setDirection(-1); setMonthIndex(prev => Math.max(0, prev - 1)); };
  const handleNextMonth = () => { setDirection(1); setMonthIndex(prev => Math.min(11, prev + 1)); };

  const rawFirstDay = new Date(engine.displayYear, monthIndex, 1).getDay();
  const firstDayOfMonth = rawFirstDay === 0 ? 6 : rawFirstDay - 1; 

  const daysInMonth = new Date(engine.displayYear, monthIndex + 1, 0).getDate();
  const days = Array.from({ length: firstDayOfMonth }, () => null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  return (
    <div className={styles.boardContainer}>
      
      {/* 🌟 渐变色定义中心 */}
      <svg style={{ width: 0, height: 0, position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD447" /> 
            <stop offset="100%" stopColor="#D99414" /> 
          </linearGradient>
          {/* 🌟 银灰色渐变：经典的成就配色 */}
          <linearGradient id="silverGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E5E5EA" />
            <stop offset="100%" stopColor="#98989D" />
          </linearGradient>
        </defs>
      </svg>

      <div className={styles.globalSection}>
        {sparklinePath && (
          <svg key={year} className={styles.sparkline} viewBox="0 0 200 40" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <defs><linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#32D74B" stopOpacity="0.25" /><stop offset="100%" stopColor="#32D74B" stopOpacity="0" /></linearGradient></defs>
            <path d={`${sparklinePath} L 200,40 L 0,40 Z`} fill="url(#sparklineGrad)" stroke="none" className={styles.sparklineFill} />
            <path d={sparklinePath} fill="none" className={styles.sparklineLine} pathLength="100" />
          </svg>
        )}
        
        <div className={styles.globalTitle}>年度总里程</div>

        <div className={styles.globalMainStat}>
          <span className={styles.val}>{animatedDist.toFixed(1)}</span>
          <span className={styles.unit}>KM</span>
        </div>
        
        <div className={styles.metricsRow}>
          <div className={styles.metricBlock}><span className={styles.metricLabel}>骑行</span><span className={styles.metricValue}>{engine.globalData.stats.rideDist.toFixed(0)}<small>km</small></span></div>
          <div className={styles.metricBlock}><span className={styles.metricLabel}>跑走</span><span className={styles.metricValue}>{engine.globalData.stats.runDist.toFixed(0)}<small>km</small></span></div>
          <div className={styles.metricBlock}><span className={styles.metricLabel}>出勤</span><span className={styles.metricValue}>{engine.globalData.stats.activeDays}<small>天</small></span></div>
          <div className={styles.metricBlock}><span className={styles.metricLabel}>连签</span><span className={styles.metricValue}>{engine.globalData.stats.maxStreak}<small>天</small></span></div>
        </div>
      </div>

      <div className={styles.calendarSection}>
        <div className={styles.monthHeader}>
          <div className={styles.monthNav}>
            <button onClick={handlePrevMonth} disabled={monthIndex === 0} title="上个月"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg></button>
            <span>{engine.displayYear}-{String(monthIndex + 1).padStart(2, '0')}</span>
            <button onClick={handleNextMonth} disabled={monthIndex === 11} title="下个月"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg></button>
          </div>
        </div>
        
        <div className={styles.weekdays}>{['一', '二', '三', '四', '五', '六', '日'].map((d, i) => (<div key={i}>{d}</div>))}</div>
        
        <div key={`${engine.displayYear}-${monthIndex}`} className={styles.grid} data-direction={direction}>
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className={styles.emptyDay} />;
            const dateStr = `${engine.displayYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayRuns = engine.monthlyData.runsByDate.get(dateStr) || [];
            const hasRun = dayRuns.length > 0;
            const primaryRun = hasRun ? dayRuns[0] : null;
            const runColor = primaryRun ? colorFromType(primaryRun.type) : '#32D74B';
            const isSelected = hasRun && runs[runIndex]?.run_id === primaryRun?.run_id;
            
            const isYearlyMax = dateStr === engine.globalData.yearlyMaxDate;
            const isMonthlyMax = !isYearlyMax && dateStr === engine.globalData.monthlyMaxDates.get(monthIndex);
            const isMaxDay = isYearlyMax || isMonthlyMax;

            return (
              <div 
                key={dateStr} 
                className={`${styles.dayCell} ${hasRun ? styles.hasRun : ''} ${isSelected ? styles.selected : ''} ${isMaxDay ? styles.maxDay : ''}`} 
                onClick={() => { if (hasRun && primaryRun) { if (isSelected) { locateActivity([]); setRunIndex(-1); } else { locateActivity([primaryRun.run_id]); setRunIndex(engine.runIdIndexMap.get(primaryRun.run_id) ?? -1); } } }} 
                style={{ 
                  backgroundColor: (isSelected && !isMaxDay) ? `${runColor}26` : undefined, 
                  boxShadow: (isSelected && !isMaxDay) ? `inset 0 0 0 1px ${runColor}` : undefined 
                }}
              >
                {hasRun && (
                  <div className={styles.runTooltip}>
                    <div className={styles.ttList}>
                      {dayRuns.map((r) => (
                        <div key={r.run_id} className={styles.ttItem}>
                          <span className={styles.ttName}>{formatRunName(r.name, r.start_date_local, r.type)}</span>
                          <span className={styles.ttVal} style={{ color: colorFromType(r.type) }}>{(r.distance / 1000).toFixed(1)} <small>km</small></span>
                        </div>
                      ))}
                    </div>
                    {isMaxDay && (
                      <div className={styles.ttAchievement} style={{ color: isYearlyMax ? '#FFD447' : '#E5E5EA' }}>
                        <span>{isYearlyMax ? '年度最远' : '月度最远'}</span>
                        <span className={styles.ttVal}>{(dayRuns.reduce((sum, r) => sum + r.distance, 0) / 1000).toFixed(1)} <small>km</small></span>
                      </div>
                    )}
                  </div>
                )}

                {isMaxDay ? (
                  isYearlyMax ? (
                    /* 🌟 年度勋章：金色奖牌图标 */
                    <svg className={styles.yearlyBadge} viewBox="0 0 24 24" fill="none">
                      <path 
                        fill="url(#goldGrad)" 
                        d="M13 2h-2c-1.886 0-2.828 0-3.414.586S7 4.114 7 6v4h10V6c0-1.886 0-2.828-.586-3.414S14.886 2 13 2" 
                        opacity=".5"
                      />
                      <path 
                        fill="url(#goldGrad)" 
                        fillRule="evenodd" 
                        d="M12 22a8 8 0 1 0 0-16a8 8 0 0 0 0 16m0-11c-.284 0-.474.34-.854 1.023l-.098.176c-.108.194-.162.29-.246.354c-.085.064-.19.088-.4.135l-.19.044c-.738.167-1.107.25-1.195.532s.164.577.667 1.165l.13.152c.143.167.215.25.247.354s.021.215 0 .438l-.02.203c-.076.785-.114 1.178.115 1.352c.23.174.576.015 1.267-.303l.178-.082c.197-.09.295-.136.399-.136s.202.046.399.136l.178.082c.691.319 1.037.477 1.267.303s.191-.567.115-1.352l-.02-.203c-.021-.223-.032-.334 0-.438s.104-.187.247-.354l.13-.152c.503-.588.755-.882.667-1.165c-.088-.282-.457-.365-1.195-.532l-.19-.044c-.21-.047-.315-.07-.4-.135c-.084-.064-.138-.16-.246-.354l-.098-.176C12.474 11.34 12.284 11 12 11" 
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    /* 🌟 月度勋章：银灰色奖牌图标 */
                    <svg className={styles.monthlyBadge} viewBox="0 0 24 24" fill="none">
                      <path 
                        fill="url(#silverGrad)" 
                        d="M13 2h-2c-1.886 0-2.828 0-3.414.586S7 4.114 7 6v4h10V6c0-1.886 0-2.828-.586-3.414S14.886 2 13 2" 
                        opacity=".5"
                      />
                      <path 
                        fill="url(#silverGrad)" 
                        fillRule="evenodd" 
                        d="M12 22a8 8 0 1 0 0-16a8 8 0 0 0 0 16m0-11c-.284 0-.474.34-.854 1.023l-.098.176c-.108.194-.162.29-.246.354c-.085.064-.19.088-.4.135l-.19.044c-.738.167-1.107.25-1.195.532s.164.577.667 1.165l.13.152c.143.167.215.25.247.354s.021.215 0 .438l-.02.203c-.076.785-.114 1.178.115 1.352c.23.174.576.015 1.267-.303l.178-.082c.197-.09.295-.136.399-.136s.202.046.399.136l.178.082c.691.319 1.037.477 1.267.303s.191-.567.115-1.352l-.02-.203c-.021-.223-.032-.334 0-.438s.104-.187.247-.354l.13-.152c.503-.588.755-.882.667-1.165c-.088-.282-.457-.365-1.195-.532l-.19-.044c-.21-.047-.315-.07-.4-.135c-.084-.064-.138-.16-.246-.354l-.098-.176C12.474 11.34 12.284 11 12 11" 
                        clipRule="evenodd"
                      />
                    </svg>
                  )
                ) : (
                  <span className={styles.dateNum} style={{ color: hasRun ? runColor : 'inherit', opacity: hasRun ? 1 : 0.3, fontWeight: hasRun ? 800 : 500, textShadow: hasRun ? `0 0 8px ${runColor}40` : 'none' }}>
                    {day}
                  </span>
                )}
                {!isMaxDay && dayRuns.length > 1 && (
                  <span className={styles.multiDot} />
                )}
              </div>
            );
          })}
        </div>

        <div className={styles.monthFooter}>
          里程 <span>{engine.monthlyData.monthDetailStats.totalDist.toFixed(1)}</span> km 
          <span className={styles.dot}>•</span> 骑行 <span>{engine.monthlyData.monthDetailStats.rideDist.toFixed(1)}</span> km 
          <span className={styles.dot}>•</span> 跑走 <span>{engine.monthlyData.monthDetailStats.runDist.toFixed(1)}</span> km
        </div>
      </div>

      <div className={styles.monthlyInsights}>
        <div className={styles.insightCard}>
          <div className={styles.insightHeader}>
            <span className={styles.insightTitle}>{engine.monthlyData.insights.hasActivities ? engine.monthlyData.insights.peakPersona : '等待记录'}<span className={styles.titleTag}>时段</span></span>
          </div>
          <div className={styles.insightContent}>
            <div className={styles.punchCard}>
              {engine.monthlyData.insights.timeBlocks.map((count, i) => (
                <div key={i} className={styles.barWrapper}>
                  <div className={styles.punchHole} style={{ backgroundColor: count > 0 ? `rgba(50, 215, 75, ${0.3 + 0.7 * (count / engine.monthlyData.insights.maxTimeBlockCount)})` : 'rgba(255,255,255,0.04)' }} />
                  <div className={styles.runTooltip}>
                    <div className={styles.ttItem}><span className={styles.ttName} style={{ color: '#8E8E93', fontSize: '0.8rem' }}>{engine.monthlyData.insights.personas[i].time}</span><span className={styles.ttVal}>{count} <small>趟</small></span></div>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.insightLabels}><span>00:00</span><span>12:00</span><span>24:00</span></div>
          </div>
        </div>

        <div className={styles.insightCard}>
          <div className={styles.insightHeader}>
            <span className={styles.insightTitle}>{engine.monthlyData.insights.validHrRuns ? engine.monthlyData.insights.hrMaxZone.title : '等待记录'}<span className={styles.titleTag}>心率</span></span>
          </div>
          <div className={styles.insightContent}>
            <div className={styles.zoneChart}>
              {engine.monthlyData.insights.hrCounts.map((count, i) => (
                <div key={i} className={styles.zoneCol}>
                  <div className={styles.zoneBar} style={{ height: engine.monthlyData.insights.validHrRuns > 0 ? `${Math.max(12, (count / engine.monthlyData.insights.validHrRuns) * 100)}%` : '12%', backgroundColor: count > 0 ? engine.monthlyData.insights.hrZonesInfo[i].color : 'rgba(255,255,255,0.05)' }} />
                  <div className={styles.runTooltip}>
                    <div className={styles.ttItem}>
                      <span className={styles.ttName} style={{ color: engine.monthlyData.insights.hrZonesInfo[i].color, fontSize: '0.8rem' }}>{engine.monthlyData.insights.hrZonesInfo[i].range} <small style={{ color: engine.monthlyData.insights.hrZonesInfo[i].color }}>BPM</small></span>
                      <span className={styles.ttVal}>{count} <small>趟</small></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.insightLabels}>{engine.monthlyData.insights.hrZonesInfo.map((info, i) => (<span key={i} className={styles.zLabel}>{info.name}</span>))}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RunCalendar;