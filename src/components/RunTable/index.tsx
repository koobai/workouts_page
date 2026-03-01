import React, { useState, useMemo, useEffect } from 'react';
import { sortDateFuncReverse, Activity, RunIds } from '@/utils/utils';
import RunRow from './RunRow';
import styles from './style.module.scss';

interface IRunTableProperties {
  runs: Activity[];
  locateActivity: (_runIds: RunIds) => void;
  setActivity: (_runs: Activity[]) => void;
  runIndex: number;
  setRunIndex: (_index: number) => void;
}

const RunTable = ({
  runs,
  locateActivity,
  setActivity,
  runIndex,
  setRunIndex,
}: IRunTableProperties) => {
  const [filterMonth, setFilterMonth] = useState('All');

  const availableMonths = useMemo(() => {
    if (!runs || runs.length === 0) return [];
    const months = new Set<string>();
    runs.forEach(r => {
      if (r.start_date_local) months.add(r.start_date_local.slice(5, 7));
    });
    return Array.from(months).sort().reverse();
  }, [runs]);

  useEffect(() => {
    if (filterMonth !== 'All' && !availableMonths.includes(filterMonth)) {
      setFilterMonth('All');
    }
  }, [availableMonths, filterMonth]);

  // 🌟 核心引擎：找出年度单次最远，以及每个月单次最远的 Run ID
  const { yearlyMaxRunId, monthlyMaxRunIds } = useMemo(() => {
    if (!runs || runs.length === 0) return { yearlyMaxRunId: -1, monthlyMaxRunIds: new Set<number>() };
    
    let yMaxDist = 0;
    let yMaxId = -1;
    
    const mMaxDist = new Map<string, number>();
    const mMaxId = new Map<string, number>();
    
    runs.forEach(run => {
      const dist = run.distance;
      const month = run.start_date_local.slice(5, 7);
      
      // 年度最高对比
      if (dist > yMaxDist) {
        yMaxDist = dist;
        yMaxId = run.run_id;
      }
      
      // 月度最高对比
      if (dist > (mMaxDist.get(month) || 0)) {
        mMaxDist.set(month, dist);
        mMaxId.set(month, run.run_id);
      }
    });
    
    // 如果某个运动已经是年度最高，就不在月度最高里重复打标了
    const monthlyIds = new Set<number>();
    mMaxId.forEach((id) => {
      if (id !== yMaxId) {
        monthlyIds.add(id);
      }
    });
    
    return { yearlyMaxRunId: yMaxId, monthlyMaxRunIds: monthlyIds };
  }, [runs]);

  const filteredRuns = useMemo(() => {
    if (!runs) return [];
    let result = runs;
    if (filterMonth !== 'All') {
      result = runs.filter(r => r.start_date_local && r.start_date_local.slice(5, 7) === filterMonth);
    }
    return [...result].sort((a, b) => {
      return new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime();
    });
  }, [runs, filterMonth]);

  return (
    <div className={styles.tableContainer}>
      
      {/* 🌟 注入勋章的全局渐变色（同步日历的高级金属配色） */}
      <svg style={{ width: 0, height: 0, position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="listGoldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD447" />
            <stop offset="100%" stopColor="#D99414" />
          </linearGradient>
          <linearGradient id="listSilverGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E5E5EA" />
            <stop offset="100%" stopColor="#98989D" />
          </linearGradient>
        </defs>
      </svg>

      <div className={styles.controlsArea}>
        {availableMonths.length > 0 && (
          <div className={styles.filterBar}>
            <div 
              className={`${styles.filterPill} ${filterMonth === 'All' ? styles.activePill : ''}`}
              onClick={() => { setFilterMonth('All'); setRunIndex(-1); }}
            >
              All
            </div>
            {availableMonths.map(m => (
              <div 
                key={m} 
                className={`${styles.filterPill} ${filterMonth === m ? styles.activePill : ''}`}
                onClick={() => { setFilterMonth(m); setRunIndex(-1); }}
              >
                {m}
              </div>
            ))}
            
            <div className={styles.monthLabel}>月</div>
          </div>
        )}
      </div>

      <div className={styles.cardList}>
        {filteredRuns.map((run, elementIndex) => (
          <RunRow
            key={run.run_id}
            elementIndex={elementIndex}
            locateActivity={locateActivity}
            run={run}
            runIndex={runIndex}
            setRunIndex={setRunIndex}
            isYearlyMax={run.run_id === yearlyMaxRunId}
            isMonthlyMax={monthlyMaxRunIds.has(run.run_id)}
          />
        ))}
      </div>
      
    </div>
  );
};

export default RunTable;