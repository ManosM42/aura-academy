import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return match;
}

/**
 * Στο κινητό η σελίδα «κλειδώνει» στο ορατό τμήμα της οθόνης (visualViewport). Όταν ανοίγει το
 * πληκτρολόγιο, όλο το UI μικραίνει ώστε να χωράει πάνω από αυτό, και ο χαρακτήρας μένει ορατός.
 * Η σελίδα πίσω δεν κινείται. Όταν enabled γίνει false, όλα επανέρχονται όπως ήταν.
 */
export function useLockedViewport(enabled: boolean) {
  const [vp, setVp] = useState({ height: 0, top: 0, keyboard: false });

  useEffect(() => {
    if (!enabled) return;
    const vv = window.visualViewport;
    let maxH = 0;
    let lastW = window.innerWidth;

    const update = () => {
      if (window.innerWidth !== lastW) {
        lastW = window.innerWidth; // περιστροφή οθόνης
        maxH = 0;
      }
      const height = Math.round(vv ? vv.height : window.innerHeight);
      const top = Math.round(vv ? vv.offsetTop : 0);
      maxH = Math.max(maxH, height); // το μεγαλύτερο ύψος που είδαμε = πληκτρολόγιο κλειστό
      const keyboard = maxH - height > 120;
      setVp((p) => (p.height === height && p.top === top && p.keyboard === keyboard ? p : { height, top, keyboard }));
      if (window.scrollY !== 0) window.scrollTo(0, 0); // το iOS σκρολάρει τη σελίδα όταν εστιάζεις input
    };
    update();

    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    // κλείδωσε τη σελίδα πίσω από το chat
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      hOverflow: html.style.overflow,
      hOverscroll: html.style.overscrollBehavior,
      bOverflow: body.style.overflow,
      bPosition: body.style.position,
      bTop: body.style.top,
      bWidth: body.style.width,
    };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      html.style.overflow = prev.hOverflow;
      html.style.overscrollBehavior = prev.hOverscroll;
      body.style.overflow = prev.bOverflow;
      body.style.position = prev.bPosition;
      body.style.top = prev.bTop;
      body.style.width = prev.bWidth;
      window.scrollTo(0, scrollY);
    };
  }, [enabled]);

  return vp;
}