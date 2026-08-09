import styles from "./home-gallery.module.css";

export function MathematicalFallback() {
  return (
    <svg
      className={styles.orbitFallback}
      viewBox="0 0 960 640"
      role="img"
      aria-labelledby="orbit-title orbit-desc"
    >
      <title id="orbit-title">三体运动轨道</title>
      <desc id="orbit-desc">
        三个数学质点沿不同椭圆轨道缓慢运动，展示轨道、引力与连续变化。
      </desc>
      <g className={styles.orbitSystem} transform="translate(520 300)">
        <ellipse className={styles.orbitOne} rx="330" ry="112" />
        <ellipse className={styles.orbitTwo} rx="230" ry="230" />
        <ellipse className={styles.orbitThree} rx="370" ry="70" />
        <circle className={styles.orbitCore} r="30" />
        <circle className={styles.orbitPointOne} r="10" />
        <circle className={styles.orbitPointTwo} r="9" />
        <circle className={styles.orbitPointThree} r="9" />
      </g>
      <text className={styles.orbitAnnotation} x="56" y="80">
        STUDY 001 / THREE BODY ORBIT
      </text>
    </svg>
  );
}
