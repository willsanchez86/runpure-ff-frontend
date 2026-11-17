/** Temporary screen body used while a screen's spec slice is unbuilt
 * (foundation spec §13 steps 5–6). Not a dead end: it names what arrives. */
import styles from "./ScreenPlaceholder.module.css";

/** View head + note; replaced by the real screen per its spec. */
export function ScreenPlaceholder({
  title,
  sub,
  note,
}: {
  title: string;
  sub: string;
  note: string;
}) {
  return (
    <section>
      <div className={styles.vhead}>
        <div>
          <h1>{title}</h1>
          <p className={styles.sub}>{sub}</p>
        </div>
      </div>
      <div className={styles.panel}>{note}</div>
    </section>
  );
}
