import Link from "next/link";
import type { MathFieldLink } from "./home-data";
import styles from "./home-gallery.module.css";

export function MathFieldMap({ fields }: { fields: MathFieldLink[] }) {
  return (
    <section className={styles.fieldSection} aria-labelledby="field-title">
      <div className={styles.sectionHeading}>
        <span className={styles.monoLabel}>EXPLORE / MATHEMATICAL FIELDS</span>
        <h2 id="field-title">沿着关系，进入数学</h2>
      </div>
      <div className={styles.fieldMap}>
        <svg className={styles.fieldLines} viewBox="0 0 1000 420" aria-hidden="true">
          <path d="M120 120 C310 40 430 240 590 140 S820 80 900 220" />
          <path d="M120 300 C280 180 450 360 620 270 S820 320 900 160" />
        </svg>
        {fields.map((field, index) => (
          <Link
            className={`${styles.fieldNode} ${styles[`fieldNode${index + 1}`]}`}
            data-accent={field.accent}
            href={field.href}
            key={field.id}
          >
            <span className={styles.fieldPoint} aria-hidden="true" />
            <span
              className={styles.fieldConstruction}
              data-field={field.id}
              aria-hidden="true"
            />
            <span className={styles.fieldName}>{field.label}</span>
            <span className={styles.fieldNameZh}>{field.labelZh}</span>
            {field.count > 0 && (
              <span className={styles.fieldCount}>{field.count} 件作品</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
