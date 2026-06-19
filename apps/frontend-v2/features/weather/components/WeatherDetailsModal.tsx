import { X, Droplets, Wind, Thermometer, CloudRain, Eye, AlertTriangle } from "lucide-react";
import { weatherIcon } from "../weatherIcon";
import type { WeatherInfo } from "@/types/api";

interface Props {
  weather: WeatherInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function WeatherDetailsModal({ weather, isOpen, onClose }: Props) {
  if (!isOpen || !weather) return null;

  const Icon = weatherIcon(weather.condition);

  // Determine beautiful custom color and gradient classes based on condition
  let bgGradient = "from-amber-500/10 to-orange-500/5";
  let iconColor = "text-amber-500";
  let conditionLabel = "Sunny";

  const cond = weather.condition.toLowerCase();
  if (cond.includes("rain") || cond.includes("drizzle")) {
    bgGradient = "from-blue-500/10 to-indigo-500/5";
    iconColor = "text-blue-500";
    conditionLabel = "Raining";
  } else if (cond.includes("cloud")) {
    bgGradient = "from-slate-400/10 to-slate-500/5";
    iconColor = "text-slate-400";
    conditionLabel = "Cloudy";
  } else if (cond.includes("thunderstorm") || cond.includes("lightning")) {
    bgGradient = "from-purple-500/10 to-indigo-500/5";
    iconColor = "text-purple-500";
    conditionLabel = "Thunderstorm";
  } else if (cond.includes("snow")) {
    bgGradient = "from-sky-300/10 to-blue-400/5";
    iconColor = "text-sky-300";
    conditionLabel = "Snowing";
  } else if (cond.includes("mist") || cond.includes("fog") || cond.includes("haze")) {
    bgGradient = "from-zinc-400/10 to-zinc-500/5";
    iconColor = "text-zinc-400";
    conditionLabel = "Misty";
  }

  if (weather.description) {
    conditionLabel = weather.description.charAt(0).toUpperCase() + weather.description.slice(1);
  }

  // Format visibility
  const visibilityText = weather.visibilityMeters != null
    ? `${(weather.visibilityMeters / 1000).toFixed(1)} km`
    : "N/A";

  // Format rain probability
  const rainProb = weather.rainProbability ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm transition-all duration-300">
      <div
        className={`relative w-full max-w-sm overflow-hidden rounded-3xl bg-card/90 p-6 shadow-2xl backdrop-blur-xl border border-border/80 bg-gradient-to-b ${bgGradient} transition-transform scale-100 duration-300`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-foreground active:scale-95 transition-transform"
          aria-label="Close weather details"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mt-2 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Weather details</p>
          <h3 className="text-2xl font-extrabold text-foreground mt-1">{weather.cityName}</h3>
        </div>

        {/* Hero Visual */}
        <div className="my-6 flex flex-col items-center justify-center">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-card shadow-inner border border-border/40">
            <Icon className={`h-14 w-14 ${iconColor} animate-pulse`} strokeWidth={1.5} />
          </div>
          <p className="mt-4 text-3xl font-black text-foreground tracking-tight">{weather.tempC}°C</p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">{conditionLabel}</p>
        </div>

        {/* Active Weather Warnings */}
        {weather.alerts && weather.alerts.length > 0 && (
          <div className="mb-4 flex flex-col gap-2 rounded-2xl bg-danger/10 p-3.5 border border-danger/25">
            <div className="flex items-center gap-1.5 text-danger">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-wide">Weather Advisories</span>
            </div>
            {weather.alerts.map((alert, idx) => (
              <p key={idx} className="text-xs font-bold text-foreground leading-normal">
                • {alert}
              </p>
            ))}
          </div>
        )}

        {/* Weather Details Grid */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {/* Feels Like */}
          <div className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3 border border-border/30">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
              <Thermometer className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Feels Like</p>
              <p className="text-sm font-extrabold text-foreground">{weather.feelsLikeC}°C</p>
            </div>
          </div>

          {/* Humidity */}
          <div className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3 border border-border/30">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
              <Droplets className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground font-black">Humidity</p>
              <p className="text-sm font-extrabold text-foreground">{weather.humidity}%</p>
            </div>
          </div>

          {/* Rain Probability */}
          <div className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3 border border-border/30">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
              <CloudRain className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground font-black">Precipitation</p>
              <p className="text-sm font-extrabold text-foreground">{rainProb}%</p>
            </div>
          </div>

          {/* Visibility */}
          <div className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3 border border-border/30">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
              <Eye className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground font-black">Visibility</p>
              <p className="text-sm font-extrabold text-foreground">{visibilityText}</p>
            </div>
          </div>

          {/* Wind */}
          <div className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3 border border-border/30 col-span-2">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
              <Wind className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground font-black">Wind Speed</p>
              <p className="text-sm font-extrabold text-foreground">{weather.windKph} km/h</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
