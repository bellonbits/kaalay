"use client";
import { motion } from "framer-motion";

interface Props {
  /** GPS accuracy in metres — widens the outer ring so the visual reflects real fix quality. */
  accuracy?: number | null;
  color?: string;
}

// Decorative branch lines radiating from the center, fixed angles/lengths
// so the layout is stable across renders.
const BRANCHES = [
  { angle: -35, length: 70 },
  { angle: 25, length: 90 },
  { angle: 100, length: 60 },
  { angle: 160, length: 80 },
  { angle: -110, length: 55 },
];

export default function SafetyPulse({ accuracy, color = "#16A34A" }: Props) {
  // Map accuracy (metres) to a visual ring scale — tighter fix, tighter rings.
  const outerScale = accuracy ? Math.min(1.4, Math.max(0.85, accuracy / 30)) : 1;

  return (
    <div className="relative flex h-56 w-56 items-center justify-center">
      <svg className="absolute h-full w-full" viewBox="-100 -100 200 200">
        {BRANCHES.map((b, i) => {
          const rad = (b.angle * Math.PI) / 180;
          const x2 = Math.cos(rad) * b.length;
          const y2 = Math.sin(rad) * b.length;
          return (
            <line
              key={i}
              x1={0}
              y1={0}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeOpacity={0.18}
              strokeWidth={1.5}
            />
          );
        })}
      </svg>

      {[1, 0.7, 0.45].map((scale, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${100 * scale * outerScale}%`,
            height: `${100 * scale * outerScale}%`,
            backgroundColor: color,
            opacity: 0.08 + i * 0.05,
          }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
        />
      ))}

      <div className="absolute h-4 w-4 rounded-full border-[3px] border-white shadow-md" style={{ backgroundColor: color }} />
    </div>
  );
}
