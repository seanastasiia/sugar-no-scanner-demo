import { PERSONAL_FIT_GUIDE, type PersonalShelfFit } from "@/lib/personal-shelf-fit";
import styles from "./personal-shelf-fit-badge.module.css";

export function personalFitCardClass(fit: PersonalShelfFit | null): string {
  return fit ? `${styles.card} ${styles[fit.tone]}` : "";
}

export function PersonalShelfFitBadge({ fit }: { fit: PersonalShelfFit | null }) {
  if (!fit) return null;
  return <span className={`${styles.badge} ${styles[fit.tone]}`} data-testid="personal-fit-badge" data-fit={fit.tone}
    title={`${fit.provisional ? "Provisional. " : ""}${PERSONAL_FIT_GUIDE}`}>{fit.label}</span>;
}
