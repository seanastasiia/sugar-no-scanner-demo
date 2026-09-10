import Image from "next/image";
import styles from "./scanner-home-logo.module.css";

export function ScannerHomeLogo({ imageClassName, priority = false, href = "/" }: {
  imageClassName?: string;
  priority?: boolean;
  href?: "/" | "/pilot/shelf";
}) {
  return (
    // A full root navigation deliberately clears transient camera, demo and result state.
    <a
      className={styles.link}
      href={href}
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
