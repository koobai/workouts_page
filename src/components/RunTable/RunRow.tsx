import { formatSpeedOrPace, formatRunName, getHeartRateColor, colorFromType, formatRunTime, Activity, RunIds } from '@/utils/utils';
import styles from './style.module.scss';

interface IRunRowProperties {
  elementIndex: number;
  locateActivity: (_runIds: RunIds) => void;
  run: Activity;
  runIndex: number;
  setRunIndex: (_ndex: number) => void;
}

const RunRow = ({ elementIndex, locateActivity, run, runIndex, setRunIndex }: IRunRowProperties) => {
  const distance = (run.distance / 1000.0).toFixed(2);
  const paceParts = run.average_speed ? formatSpeedOrPace(run.average_speed, run.type) : null;
  let paceUI: React.ReactNode = paceParts;
  if (typeof paceParts === 'string' && paceParts.includes(' ')) {
    const parts = paceParts.split(' ');
    paceUI = (
      <span>
        {parts[0]}
        <span className={styles.paceUnit}>
          {parts[1]}
        </span>
      </span>
    );
  }
  const heartRate = run.average_heartrate;
  const type = run.type;
  const runTime = formatRunTime(run.moving_time);
  const handleClick = () => {
    if (runIndex === elementIndex) {
      setRunIndex(-1);
      locateActivity([]);
      return
    };
    setRunIndex(elementIndex);
    locateActivity([run.run_id]);
  };
  const datePart = run.start_date_local.slice(5, 10); // 提取 "12-04"
  const timePart = run.start_date_local.slice(11, 16); // 提取 "10:40"
  return (
    <tr
      className={`${styles.runRow} ${runIndex === elementIndex ? styles.selected : ''}`}
      key={run.start_date_local}
      onClick={handleClick}
      style={{
        color: colorFromType(type),
        animationDelay: `${Math.min(elementIndex * 0.05, 1.2)}s`
      }}
    >
      <td>{formatRunName(run.name, run.start_date_local, run.type)}</td>
      <td>
      {distance}
      <span style={{ fontSize: '0.75em', marginLeft: '3px', opacity: 0.7 }}>
        km
      </span>
    </td>
      <td>{paceUI}</td>
      <td style={{ color: heartRate ? getHeartRateColor(heartRate) : 'inherit' }}>
        {heartRate ? (
          <>
          <span className={styles.heartRateWrapper}>
            {heartRate.toFixed(0)}
            {heartRate >= 130 && (
              <span className={styles.heartRateEmoji}>🔥</span>
            )}
            </span>
          </>
        ) : '-'}
      </td>
      <td>{runTime}</td>
      <td className={styles.runDate}>
        <span className={styles.datePart}>{datePart}</span>
        <span className={styles.timePart}>{timePart}</span>
      </td>
    </tr>
  );
};

export default RunRow;
