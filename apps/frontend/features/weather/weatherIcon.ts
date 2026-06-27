import { Sun, Cloud, CloudRain, CloudDrizzle, CloudSnow, CloudLightning, CloudFog, type LucideIcon } from "lucide-react";

/** Maps OpenWeather's `weather[0].main` condition string to a lucide icon —
 * keeps weather UI on the same icon system as the rest of the app instead
 * of pulling in OpenWeather's own icon images. */
export function weatherIcon(condition: string): LucideIcon {
  switch (condition) {
    case "Clear":
      return Sun;
    case "Rain":
      return CloudRain;
    case "Drizzle":
      return CloudDrizzle;
    case "Thunderstorm":
      return CloudLightning;
    case "Snow":
      return CloudSnow;
    case "Mist":
    case "Fog":
    case "Haze":
    case "Smoke":
    case "Dust":
      return CloudFog;
    case "Clouds":
      return Cloud;
    default:
      return Cloud;
  }
}
