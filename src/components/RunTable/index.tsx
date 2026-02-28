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
                {/* 🌟 直接渲染 01, 02 这种纯粹的数字格式 */}
                {m}
              </div>
            ))}
            
            {/* 🌟 在列表的最后/最右侧加上“月”字标签 */}
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
          />
        ))}
      </div>
      
    </div>
  );
};

export default RunTable;