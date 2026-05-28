/**
 * components/PinIcon.ts
 * Returns HTML strings for AdvancedMarkerElement content.
 * These render as DOM elements inside google.maps.marker.AdvancedMarkerElement.
 *
 * Usage:
 *   new google.maps.marker.AdvancedMarkerElement({
 *     map, position,
 *     content: PinIcon.me(),
 *   });
 */

const PinIcon = {
  /** Blue GPS dot (current user location) */
  me(): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="
        width: 20px; height: 20px; border-radius: 50%;
        background: #4285F4; border: 3px solid #fff;
        box-shadow: 0 2px 8px rgba(66,133,244,0.5);
      "></div>
    `;
    return el;
  },

  /** Uber-blue teardrop pin for destinations / request waypoints */
  destination(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
    el.innerHTML = `
      <div style="
        width: 36px; height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: #276EF1;
        border: 3px solid #fff;
        box-shadow: 0 4px 14px rgba(39,110,241,0.45);
      "></div>
    `;
    return el;
  },

  /** Navy blue teardrop pin for pickup/request markers (Kaalay brand) */
  request(): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = `<img
      src="/icon-3d-pin-blue.png"
      alt="pickup"
      style="width:44px;height:52px;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.25));"
      draggable="false"
    />`;
    return el;
  },

  /** Yellow teardrop pin for tracked people / saved places */
  place(): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = `<img
      src="/icon-3d-dest-pin.png"
      alt="place"
      style="width:40px;height:48px;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.2));"
      draggable="false"
    />`;
    return el;
  },

  /** Avatar circle for a named group member */
  member(color: string, initial: string): HTMLElement {
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="
        width: 32px; height: 32px; border-radius: 50%;
        background: ${color}; border: 2.5px solid #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: 900; color: #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.22);
        font-family: sans-serif;
      ">${initial.charAt(0).toUpperCase()}</div>
    `;
    return el;
  },

  /** Vehicle icon for drivers (taxi or bike) */
  car(category: 'bike' | 'economy' | string = 'economy'): HTMLElement {
    const src = category === 'bike' ? '/icon-bike.png' : '/icon-taxi.png';
    const el = document.createElement('div');
    el.innerHTML = `<img
      src="${src}"
      alt="vehicle"
      style="width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.3));"
      draggable="false"
    />`;
    return el;
  },
};

export default PinIcon;
