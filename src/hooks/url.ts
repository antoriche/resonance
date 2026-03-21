import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Syncs a boolean state with a URL hash anchor.
 * @param anchor - The anchor name without `#` (e.g. "side-panel" → `#side-panel`)
 * @returns [isActive, setActive] — true when the current hash matches the anchor
 */
export function useAnchor(
  anchor: string,
): [boolean, (active: boolean) => void] {
  const router = useRouter();
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const target = `#${anchor}`;
    const onHashChange = () => setIsActive(window.location.hash === target);
    setIsActive(window.location.hash === target);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [anchor]);

  const set = (active: boolean) => {
    if (active) {
      router.replace(`${window.location.pathname}#${anchor}`, {
        scroll: false,
      });
    } else {
      router.replace(window.location.pathname, { scroll: false });
    }
    setIsActive(active);
  };

  return [isActive, set];
}
