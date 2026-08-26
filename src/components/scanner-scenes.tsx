import Image from "next/image";
import type { MediaDimensions } from "@/lib/camera-focus";
import styles from "./scanner-app.module.css";

interface SceneProps {
  onLoad: (dimensions: MediaDimensions) => void;
}

function sceneDimensions(event: React.SyntheticEvent<HTMLImageElement>): MediaDimensions {
  return {
    width: event.currentTarget.naturalWidth,
    height: event.currentTarget.naturalHeight
  };
}

export function ShelfScene({ onLoad }: SceneProps) {
  return (
    <div className={styles.shelfScene} aria-label="Sample shelf photo with four supported protein snacks">
      <Image
        className={styles.samplePhoto}
        src="/samples/latvia-shelf.jpg"
        alt="Four protein bars on a supermarket shelf"
        fill
        sizes="100vw"
        priority
        unoptimized
        onLoad={(event) => onLoad(sceneDimensions(event))}
      />
    </div>
  );
}

export function CheckoutScene({ onLoad }: SceneProps) {
  return (
    <div
      className={styles.checkoutScene}
      aria-label="Real supermarket checkout belt sample with three recognized packaged products"
    >
      <Image
        className={styles.samplePhoto}
        src="/samples/latvia-checkout.jpg"
        alt="Groceries on a real supermarket checkout conveyor belt"
        fill
        sizes="100vw"
        priority
        unoptimized
        onLoad={(event) => onLoad(sceneDimensions(event))}
      />
    </div>
  );
}
