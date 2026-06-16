"use client";
import { Volume2, VolumeX, X, CornerUpLeft, CornerUpRight, ArrowUp } from "lucide-react";
import { formatDistance, formatDuration, cardinalDirection } from "@/features/location/geo";

function turnIcon(instruction: string) {
  const lower = instruction.toLowerCase();
  if (lower.includes("left")) return CornerUpLeft;
  if (lower.includes("right")) return CornerUpRight;
  return ArrowUp;
}

interface RoadHudProps {
  mode: "road";
  instruction: string;
  distanceToStepMeters: number;
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  arrivalTime: Date;
  speedKmh: number | null;
  confidence: "high" | "low";
  voiceOn: boolean;
  voiceAvailable: boolean;
  onToggleVoice: () => void;
  onCancel: () => void;
}

interface PrecisionHudProps {
  mode: "precision";
  bearingDeg: number;
  remainingDistanceMeters: number;
  destinationLabel: string;
  speedKmh: number | null;
  voiceOn: boolean;
  voiceAvailable: boolean;
  onToggleVoice: () => void;
  onCancel: () => void;
}

type Props = RoadHudProps | PrecisionHudProps;

export default function NavigationHud(props: Props) {
  const { voiceOn, voiceAvailable, onToggleVoice, onCancel, speedKmh } = props;
  const Icon = props.mode === "road" ? turnIcon(props.instruction) : null;

  return (
    <>
      {/* Top bar — dark turn-by-turn pill (road) or compass headline (precision) */}
      <div className="absolute left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-30">
        {props.mode === "road" && Icon ? (
          <div className="flex items-center gap-4 rounded-3xl bg-foreground p-3 pr-4 shadow-2xl">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary">
              <Icon className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-extrabold leading-tight text-white">{formatDistance(props.distanceToStepMeters)}</p>
              <p className="truncate text-sm font-semibold text-white/70">{props.instruction}</p>
            </div>
            <VoiceToggle on={voiceOn} available={voiceAvailable} onToggle={onToggleVoice} dark />
          </div>
        ) : props.mode === "precision" ? (
          <div className="rounded-2xl bg-card/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-danger">
                Precision mode
              </span>
              <VoiceToggle on={voiceOn} available={voiceAvailable} onToggle={onToggleVoice} />
            </div>
            <p className="mt-2 text-lg font-extrabold leading-tight text-foreground">
              Head {cardinalDirection(props.bearingDeg)} toward {props.destinationLabel}
            </p>
            <p className="text-sm font-semibold text-muted-foreground">No mapped road here — follow the compass</p>
          </div>
        ) : null}
      </div>

      {/* Compass dial for precision mode */}
      {props.mode === "precision" && (
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-foreground bg-card/90 shadow-xl"
            style={{ transform: `rotate(${props.bearingDeg}deg)` }}
          >
            <div className="h-10 w-1.5 -translate-y-7 rounded-full bg-emergency" />
          </div>
        </div>
      )}

      {/* Bottom HUD — distance, ETA, speed, cancel */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <div className="rounded-3xl bg-card p-5 shadow-xl">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-extrabold text-foreground">{formatDistance(props.remainingDistanceMeters)}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Remaining</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-foreground">
                {props.mode === "road" ? formatDuration(props.remainingDurationSeconds) : "—"}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">ETA</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-foreground">{speedKmh !== null ? `${Math.round(speedKmh)} km/h` : "—"}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Speed</p>
            </div>
          </div>
          {props.mode === "road" && (
            <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">
              Arriving around {props.arrivalTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          <button
            onClick={onCancel}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-sm font-bold text-foreground active:scale-95 transition-transform"
          >
            <X className="h-4 w-4" /> Cancel navigation
          </button>
        </div>
      </div>
    </>
  );
}

function VoiceToggle({ on, available, onToggle, dark }: { on: boolean; available: boolean; onToggle: () => void; dark?: boolean }) {
  return (
    <button
      onClick={onToggle}
      aria-label={on ? "Mute voice guidance" : "Unmute voice guidance"}
      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full active:scale-90 transition-transform ${
        dark ? "bg-white/15" : "bg-secondary"
      }`}
      title={!available ? "Voice not available in this language on this device — using English" : undefined}
    >
      {on ? (
        <Volume2 className={`h-4 w-4 ${dark ? "text-white" : "text-foreground"}`} />
      ) : (
        <VolumeX className={`h-4 w-4 ${dark ? "text-white/60" : "text-muted-foreground"}`} />
      )}
    </button>
  );
}
