import Image from "next/image";
import styles from "./scanner-home-logo.module.css";

export function ScannerHomeLogo({ imageClassName, priority = false }: {
  imageClassName?: string;
  priority?: boolean;
}) {
  return (
    // A full root navigation deliberately clears transient camera, demo and result state.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      className={styles.link}
      href="/"
      aria-label="Sugar.no scanner home"
    >
      <Image
        className={imageClassName}
        src="/brand/sugar-no-logo-white.svg"
        alt="Sugar.no"
        width={137}
        height={26.07}
        priority={priority}
        unoptimized
      />
    </a>
  );
}
