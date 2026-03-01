import React from 'react';
import { formatSpeedOrPace, formatRunName, colorFromType, formatRunTime, Activity, RunIds } from '@/utils/utils';
import styles from './style.module.scss';

const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'EBikeRide']);
const WALK_TYPES = new Set(['Walk', 'Hike']); 
const RUN_TYPES = new Set(['Run', 'TrailRun']);
const SWIM_TYPES = new Set(['Swim', 'WaterSport']); 

interface IRunRowProperties {
  elementIndex: number;
  locateActivity: (_runIds: RunIds) => void;
  run: Activity;
  runIndex: number;
  setRunIndex: (_ndex: number) => void;
  isYearlyMax?: boolean;
  isMonthlyMax?: boolean;
}

const RunRow = ({ elementIndex, locateActivity, run, runIndex, setRunIndex, isYearlyMax, isMonthlyMax }: IRunRowProperties) => {
  const distance = (run.distance / 1000.0).toFixed(2);
  const paceParts = run.average_speed ? formatSpeedOrPace(run.average_speed, run.type) : null;
  const heartRate = run.average_heartrate;
  const type = run.type;
  const isRide = RIDE_TYPES.has(type);
  const runTime = formatRunTime(run.moving_time);
  const themeColor = colorFromType(type);
  
  const handleClick = () => {
    if (runIndex === elementIndex) {
      setRunIndex(-1);
      locateActivity([]);
      return;
    }
    setRunIndex(elementIndex);
    locateActivity([run.run_id]);
  };
  
  const dateStr = run.start_date_local || '';
  const datePart = dateStr.length >= 10 ? dateStr.slice(5, 10) : ''; 
  const timePart = dateStr.length >= 16 ? dateStr.slice(11, 16) : ''; 

  const getActivityIcon = () => {
    if (isRide) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -1 26 26">
          <path fill="currentColor" d="M5.5 21a4.5 4.5 0 1 1 0-9a4.5 4.5 0 0 1 0 9m0-2a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5m13 2a4.5 4.5 0 1 1 0-9a4.5 4.5 0 0 1 0 9m0-2a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5m-7.477-8.695L13 12v6h-2v-5l-2.719-2.266A2 2 0 0 1 8 7.671l2.828-2.828a2 2 0 0 1 2.829 0l1.414 1.414a6.97 6.97 0 0 0 3.917 1.975l-.01 2.015a8.96 8.96 0 0 1-5.321-2.575zM16 5a2 2 0 1 1 0-4a2 2 0 0 1 0 4"/>
        </svg>
      );
    }
    if (WALK_TYPES.has(type)) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48">
          <g fill="currentColor">
            <path d="M31.25 8a4 4 0 1 1-8 0a4 4 0 0 1 8 0m-5.557 20.397l5.193 5.124a2 2 0 0 1 .457.693l2.769 7.055a2 2 0 0 1-3.724 1.462l-2.614-6.661l-8.928-8.81a2 2 0 0 1-.583-1.649l.715-6.32c-1.724 1.714-3.054 4.123-4.073 7.316a2 2 0 1 1-3.81-1.216c1.87-5.86 4.975-10.246 10.185-12.257l.023-.009c1.327-.493 2.707-.453 3.937.182c1.181.611 2.022 1.666 2.573 2.848l.648 1.4c.488 1.058.898 1.95 1.293 2.732c.553 1.1.998 1.83 1.438 2.342c.408.474.813.766 1.33.968c.556.217 1.335.367 2.538.403a2 2 0 1 1-.12 3.998c-1.445-.043-2.728-.228-3.873-.675c-1.183-.462-2.116-1.165-2.91-2.09c-.5-.582-.94-1.247-1.35-1.97z"/>
            <path d="m18.263 30.22l3.315 3.18l-1.526 5.147a2 2 0 0 1-.684 1.006l-5.134 4.023a2 2 0 0 1-2.467-3.15l4.632-3.628l1.395-4.71z"/>
          </g>
        </svg>
      );
    }
    if (RUN_TYPES.has(type)) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
          <circle cx="17" cy="4" r="2" fill="currentColor"/>
          <path fill="currentColor" d="M15.777 10.969a2.01 2.01 0 0 0 2.148.83l3.316-.829l-.483-1.94l-3.316.829l-1.379-2.067a2 2 0 0 0-1.272-.854l-3.846-.77a2 2 0 0 0-2.181 1.067l-1.658 3.316l1.789.895l1.658-3.317l1.967.394L7.434 17H3v2h4.434c.698 0 1.355-.372 1.715-.971l1.918-3.196l5.169 1.034l1.816 5.449l1.896-.633l-1.815-5.448a2.01 2.01 0 0 0-1.506-1.33l-3.039-.607l1.772-2.954z"/>
        </svg>
      );
    }
    if (SWIM_TYPES.has(type)) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 13c.5.5 2.13-.112 3.262-.5c1.46-.5 3.238 0 2.738-.5l-2-2s-4.5 2.5-4 3m-9 7c2 0 3-1 5-1s3 1 5 1s3-1 5-1s3 1 5 1M2 16c2 0 3-1 5-1s3 1 5 1s3-1 5-1s3 1 5 1M17.5 4l-5.278 3l3.278 3.5L12 12m7.222-2a1 1 0 1 0 0-2a1 1 0 0 0 0 2"/></svg>
      );
    }
    return '🏅';
  };

  let paceNum: React.ReactNode = '';
  let paceUnit = '';

  if (paceParts) {
    if (Array.isArray(paceParts)) {
      paceNum = paceParts[0];
      paceUnit = paceParts[1] as string;
    } else if (typeof paceParts === 'string') {
      if (paceParts.includes('km/h')) {
        paceNum = paceParts.replace(/km\/h/i, '').trim();
        paceUnit = 'km/h';
      } else if (paceParts.includes('/100m')) {
        paceNum = paceParts.replace(/\/100m/i, '').trim();
        paceUnit = '/100m';
      } else {
        paceNum = paceParts.replace(' ', '');
        paceUnit = '';
      }
    }
  }

  const stats = [
    { label: '用时', num: runTime, unit: '' }
  ];
  if (paceNum) stats.push({ label: isRide ? '均速' : '配速', num: paceNum, unit: paceUnit });
  
  if (heartRate && heartRate > 0) stats.push({ label: '心率', num: heartRate.toFixed(0), unit: '' });

  return (
    <div
      className={`${styles.runCard} ${runIndex === elementIndex ? styles.selectedCard : ''}`}
      onClick={handleClick}
    >
      <div className={styles.iconRing} style={{ color: themeColor }}>
        {getActivityIcon()}
      </div>

      <div className={styles.cardContent}>
        <div className={styles.leftInfo}>
          <div className={styles.runName}>{formatRunName(run.name, run.start_date_local, run.type)}</div>
          <div className={styles.runDistance} style={{ color: themeColor }}>
            {distance}<span className={styles.distUnit}>km</span>
            
            {/* 🌟 替换为新版的纯净无边框金属金奖牌 */}
            {isYearlyMax && (
              <svg className={styles.badgeIcon} viewBox="0 0 24 24" fill="none">
                <path fill="url(#listGoldGrad)" d="M13 2h-2c-1.886 0-2.828 0-3.414.586S7 4.114 7 6v4h10V6c0-1.886 0-2.828-.586-3.414S14.886 2 13 2" opacity=".5"/>
                <path fill="url(#listGoldGrad)" fillRule="evenodd" d="M12 22a8 8 0 1 0 0-16a8 8 0 0 0 0 16m0-11c-.284 0-.474.34-.854 1.023l-.098.176c-.108.194-.162.29-.246.354c-.085.064-.19.088-.4.135l-.19.044c-.738.167-1.107.25-1.195.532s.164.577.667 1.165l.13.152c.143.167.215.25.247.354s.021.215 0 .438l-.02.203c-.076.785-.114 1.178.115 1.352c.23.174.576.015 1.267-.303l.178-.082c.197-.09.295-.136.399-.136s.202.046.399.136l.178.082c.691.319 1.037.477 1.267.303s.191-.567.115-1.352l-.02-.203c-.021-.223-.032-.334 0-.438s.104-.187.247-.354l.13-.152c.503-.588.755-.882.667-1.165c-.088-.282-.457-.365-1.195-.532l-.19-.044c-.21-.047-.315-.07-.4-.135c-.084-.064-.138-.16-.246-.354l-.098-.176C12.474 11.34 12.284 11 12 11" clipRule="evenodd"/>
              </svg>
            )}
            {/* 🌟 替换为新版的纯净无边框极光银奖牌 */}
            {isMonthlyMax && (
              <svg className={styles.badgeIcon} viewBox="0 0 24 24" fill="none">
                <path fill="url(#listSilverGrad)" d="M13 2h-2c-1.886 0-2.828 0-3.414.586S7 4.114 7 6v4h10V6c0-1.886 0-2.828-.586-3.414S14.886 2 13 2" opacity=".5"/>
                <path fill="url(#listSilverGrad)" fillRule="evenodd" d="M12 22a8 8 0 1 0 0-16a8 8 0 0 0 0 16m0-11c-.284 0-.474.34-.854 1.023l-.098.176c-.108.194-.162.29-.246.354c-.085.064-.19.088-.4.135l-.19.044c-.738.167-1.107.25-1.195.532s.164.577.667 1.165l.13.152c.143.167.215.25.247.354s.021.215 0 .438l-.02.203c-.076.785-.114 1.178.115 1.352c.23.174.576.015 1.267-.303l.178-.082c.197-.09.295-.136.399-.136s.202.046.399.136l.178.082c.691.319 1.037.477 1.267.303s.191-.567.115-1.352l-.02-.203c-.021-.223-.032-.334 0-.438s.104-.187.247-.354l.13-.152c.503-.588.755-.882.667-1.165c-.088-.282-.457-.365-1.195-.532l-.19-.044c-.21-.047-.315-.07-.4-.135c-.084-.064-.138-.16-.246-.354l-.098-.176C12.474 11.34 12.284 11 12 11" clipRule="evenodd"/>
              </svg>
            )}
          </div>
        </div>

        <div className={styles.rightInfo}>
          <div className={styles.runDate}>{datePart} {timePart}</div>
        </div>
      </div>

      <div className={styles.runTooltip}>
        <div className={styles.ttList}>
          {stats.map((s, i) => (
            <div key={i} className={styles.ttItem}>
              <div className={styles.ttNameWrap}>
                <span className={styles.ttName}>{s.label}</span>
                {s.unit && <span className={styles.ttUnitTag}>{s.unit}</span>}
              </div>
              <span className={styles.ttNum}>{s.num}</span>
            </div>
          ))}
        </div>
        
        {/* 🌟 悬浮提示框里的文字也同步调整为了金属金 / 极光银 */}
        {(isYearlyMax || isMonthlyMax) && (
          <div className={styles.ttAchievement} style={{ color: isYearlyMax ? '#FFD447' : '#E5E5EA' }}>
            <span>{isYearlyMax ? '年度单次最远' : '月度单次最远'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RunRow;