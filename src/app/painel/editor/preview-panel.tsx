import { DigitalCard } from "@/components/digital-card";
import type { CardContent } from "@/lib/card/types";
import styles from "./editor.module.css";

export function PreviewPanel({ content }: { content: CardContent }) {
  return <div className={styles.previewViewport}><DigitalCard content={content} preview /></div>;
}
