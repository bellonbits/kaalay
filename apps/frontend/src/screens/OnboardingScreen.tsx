import React, { useState } from 'react';

interface Props {
  onDone: () => void;
}

const slides = [
  {
    title: 'Select your destination',
    subtitle: 'Choose your destination by searching or dropping a pin on the map.',
  },
  {
    title: 'Pick your ride type',
    subtitle: 'Choose Standard, Eco, or Business — all at fair prices.',
  },
  {
    title: 'Track in real time',
    subtitle: 'Watch your driver arrive live on the map and ride safely.',
  },
];

/** Isometric city scene matching the design — green bg, purple buildings, green taxi, red pins */
const CityIllustration: React.FC = () => (
  <svg width="360" height="340" viewBox="0 0 360 340" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* ===== ROAD (white diagonal band) ===== */}
    {/* Main road going diagonally top-right to bottom-left */}
    <polygon points="60,260 160,100 220,100 120,260" fill="white" opacity="0.95"/>
    {/* Road center dashes */}
    <polygon points="115,230 125,210 135,210 125,230" fill="#C8E84A" opacity="0.7"/>
    <polygon points="133,195 143,175 153,175 143,195" fill="#C8E84A" opacity="0.7"/>
    <polygon points="151,160 161,140 171,140 161,160" fill="#C8E84A" opacity="0.7"/>

    {/* ===== BUILDINGS — isometric style ===== */}

    {/* Building A — tall left-center */}
    {/* Front face */}
    <polygon points="55,280 55,120 105,95 105,255" fill="#9B8ED4"/>
    {/* Side face */}
    <polygon points="105,95 155,120 155,280 105,255" fill="#7B6AB8"/>
    {/* Top face */}
    <polygon points="55,120 105,95 155,120 105,145" fill="#B4A8E0"/>
    {/* Windows front */}
    <rect x="64" y="135" width="14" height="14" rx="2" fill="white" opacity="0.8"/>
    <rect x="84" y="135" width="14" height="14" rx="2" fill="white" opacity="0.4"/>
    <rect x="64" y="160" width="14" height="14" rx="2" fill="#A8D83F" opacity="0.9"/>
    <rect x="84" y="160" width="14" height="14" rx="2" fill="white" opacity="0.6"/>
    <rect x="64" y="185" width="14" height="14" rx="2" fill="white" opacity="0.5"/>
    <rect x="84" y="185" width="14" height="14" rx="2" fill="#A8D83F" opacity="0.8"/>
    <rect x="64" y="210" width="14" height="14" rx="2" fill="white" opacity="0.7"/>
    <rect x="84" y="210" width="14" height="14" rx="2" fill="white" opacity="0.3"/>
    <rect x="64" y="235" width="14" height="24" rx="2" fill="#5A4A9A" opacity="0.8"/>
    {/* Windows side */}
    <rect x="114" y="140" width="12" height="12" rx="2" fill="white" opacity="0.4"/>
    <rect x="130" y="148" width="12" height="12" rx="2" fill="#A8D83F" opacity="0.5"/>
    <rect x="114" y="165" width="12" height="12" rx="2" fill="white" opacity="0.6"/>
    <rect x="130" y="173" width="12" height="12" rx="2" fill="white" opacity="0.3"/>
    <rect x="114" y="190" width="12" height="12" rx="2" fill="#A8D83F" opacity="0.7"/>
    <rect x="130" y="198" width="12" height="12" rx="2" fill="white" opacity="0.5"/>

    {/* Building B — medium right */}
    {/* Front face */}
    <polygon points="185,270 185,155 230,132 230,248" fill="#A092D8"/>
    {/* Side face */}
    <polygon points="230,132 270,155 270,270 230,248" fill="#8070C0"/>
    {/* Top face */}
    <polygon points="185,155 230,132 270,155 230,178" fill="#C0B4EC"/>
    {/* Windows front */}
    <rect x="192" y="168" width="12" height="12" rx="2" fill="white" opacity="0.8"/>
    <rect x="210" y="168" width="12" height="12" rx="2" fill="#A8D83F" opacity="0.7"/>
    <rect x="192" y="190" width="12" height="12" rx="2" fill="white" opacity="0.5"/>
    <rect x="210" y="190" width="12" height="12" rx="2" fill="white" opacity="0.9"/>
    <rect x="192" y="212" width="12" height="12" rx="2" fill="#A8D83F" opacity="0.6"/>
    <rect x="210" y="212" width="12" height="12" rx="2" fill="white" opacity="0.4"/>
    <rect x="192" y="234" width="12" height="18" rx="2" fill="#6050A0" opacity="0.8"/>
    {/* Windows side */}
    <rect x="238" y="168" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
    <rect x="252" y="175" width="10" height="10" rx="2" fill="#A8D83F" opacity="0.5"/>
    <rect x="238" y="190" width="10" height="10" rx="2" fill="white" opacity="0.6"/>
    <rect x="252" y="197" width="10" height="10" rx="2" fill="white" opacity="0.3"/>

    {/* Building C — small far right */}
    <polygon points="270,255 270,185 305,165 305,236" fill="#8C7DC8"/>
    <polygon points="305,165 335,185 335,255 305,236" fill="#6C5DB0"/>
    <polygon points="270,185 305,165 335,185 305,205" fill="#A89AE0"/>
    <rect x="278" y="197" width="10" height="10" rx="2" fill="white" opacity="0.7"/>
    <rect x="293" y="197" width="10" height="10" rx="2" fill="#A8D83F" opacity="0.5"/>
    <rect x="278" y="215" width="10" height="10" rx="2" fill="white" opacity="0.4"/>
    <rect x="293" y="215" width="10" height="10" rx="2" fill="white" opacity="0.8"/>
    <rect x="278" y="233" width="10" height="14" rx="2" fill="#5040900" opacity="0.8"/>

    {/* Building D — small back left */}
    <polygon points="30,240 30,180 65,162 65,220" fill="#7060B8"/>
    <polygon points="65,162 95,180 95,240 65,220" fill="#5548A0"/>
    <polygon points="30,180 65,162 95,180 65,198" fill="#9888D0"/>
    <rect x="38" y="190" width="10" height="10" rx="2" fill="white" opacity="0.5"/>
    <rect x="52" y="190" width="10" height="10" rx="2" fill="#A8D83F" opacity="0.6"/>
    <rect x="38" y="208" width="10" height="10" rx="2" fill="white" opacity="0.7"/>

    {/* ===== TAXI CAR (large, green, prominent) ===== */}
    {/* Shadow */}
    <ellipse cx="148" cy="295" rx="65" ry="12" fill="rgba(0,0,0,0.2)"/>
    {/* Body */}
    <polygon points="88,280 88,258 198,258 198,280" fill="#A8D83F"/>
    {/* Side of body */}
    <polygon points="198,258 220,245 220,267 198,280" fill="#8FBB2A"/>
    {/* Top/cabin */}
    <polygon points="100,258 106,232 172,232 178,258" fill="#C4EE60"/>
    {/* Cabin side */}
    <polygon points="178,232 172,258 198,258 204,234" fill="#A0C840"/>
    {/* Cabin top */}
    <polygon points="106,232 112,218 170,218 172,232" fill="#D8F870"/>
    {/* Windows */}
    <polygon points="112,254 115,236 145,236 145,254" fill="#7ECDE4" opacity="0.8"/>
    <polygon points="148,254 148,236 168,236 170,254" fill="#7ECDE4" opacity="0.8"/>
    {/* Cabin side window */}
    <polygon points="180,233 196,234 195,252 178,252" fill="#7ECDE4" opacity="0.6"/>
    {/* Checkerboard stripe */}
    <rect x="88" y="265" width="8" height="8" fill="#1A1A2E"/>
    <rect x="96" y="265" width="8" height="8" fill="#A8D83F"/>
    <rect x="104" y="265" width="8" height="8" fill="#1A1A2E"/>
    <rect x="112" y="265" width="8" height="8" fill="#A8D83F"/>
    <rect x="120" y="265" width="8" height="8" fill="#1A1A2E"/>
    <rect x="128" y="265" width="8" height="8" fill="#A8D83F"/>
    <rect x="136" y="265" width="8" height="8" fill="#1A1A2E"/>
    <rect x="144" y="265" width="8" height="8" fill="#A8D83F"/>
    <rect x="152" y="265" width="8" height="8" fill="#1A1A2E"/>
    <rect x="160" y="265" width="8" height="8" fill="#A8D83F"/>
    <rect x="168" y="265" width="8" height="8" fill="#1A1A2E"/>
    <rect x="176" y="265" width="8" height="8" fill="#A8D83F"/>
    <rect x="184" y="265" width="8" height="8" fill="#1A1A2E"/>
    <rect x="192" y="265" width="6" height="8" fill="#A8D83F"/>
    {/* Wheels */}
    <circle cx="108" cy="283" r="14" fill="#1A1A2E"/>
    <circle cx="108" cy="283" r="8" fill="#3A3A4E"/>
    <circle cx="108" cy="283" r="4" fill="#888"/>
    <circle cx="178" cy="283" r="14" fill="#1A1A2E"/>
    <circle cx="178" cy="283" r="8" fill="#3A3A4E"/>
    <circle cx="178" cy="283" r="4" fill="#888"/>
    {/* Side wheel */}
    <ellipse cx="210" cy="278" rx="8" ry="12" fill="#1A1A2E"/>
    <ellipse cx="210" cy="278" rx="4" ry="7" fill="#3A3A4E"/>
    {/* TAXI text on roof */}
    <polygon points="124,218 128,206 152,206 148,218" fill="#F7B731"/>
    <text x="130" y="215" fill="#1A1A2E" fontSize="8" fontWeight="bold" fontFamily="sans-serif">TAXI</text>
    {/* Headlights */}
    <rect x="85" y="260" width="6" height="10" rx="2" fill="#FFF3A0" opacity="0.9"/>
    {/* Taillights */}
    <rect x="196" y="259" width="4" height="8" rx="1" fill="#FF4444" opacity="0.8"/>

    {/* ===== RED LOCATION PINS ===== */}
    {/* Pin 1 — top right area */}
    <circle cx="294" cy="88" r="16" fill="#EB3B5A"/>
    <circle cx="294" cy="88" r="7" fill="white"/>
    <polygon points="285,100 294,122 303,100" fill="#EB3B5A"/>
    {/* Pin 2 — bottom left */}
    <circle cx="56" cy="318" r="14" fill="#EB3B5A"/>
    <circle cx="56" cy="318" r="6" fill="white"/>
    <polygon points="48,328 56,346 64,328" fill="#EB3B5A"/>

    {/* ===== TREES ===== */}
    <circle cx="168" cy="98" r="12" fill="#5A9A30" opacity="0.8"/>
    <rect x="165" y="108" width="6" height="10" rx="2" fill="#6B4423" opacity="0.8"/>
    <circle cx="32" cy="148" r="10" fill="#5A9A30" opacity="0.7"/>
    <rect x="29" y="156" width="6" height="8" rx="2" fill="#6B4423" opacity="0.7"/>
    <circle cx="320" cy="148" r="9" fill="#5A9A30" opacity="0.6"/>
    <rect x="317" y="155" width="6" height="7" rx="2" fill="#6B4423" opacity="0.6"/>
  </svg>
);

const OnboardingScreen: React.FC<Props> = ({ onDone }) => {
  const [current, setCurrent] = useState(0);

  const handleNext = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      onDone();
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#A8D83F' }}>
      {/* Green illustration area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '0', overflow: 'hidden', position: 'relative' }}>
        <CityIllustration />
      </div>

      {/* Dark bottom card */}
      <div style={{
        background: '#1A1A2E',
        borderRadius: '28px 28px 0 0',
        padding: '32px 28px 48px',
        color: 'white',
        flexShrink: 0,
      }}>
        <h2 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '10px', lineHeight: 1.2, letterSpacing: '-0.5px' }}>
          {slides[current].title}
        </h2>
        <p style={{ fontSize: '14px', color: '#8E8E9A', lineHeight: 1.6, marginBottom: '32px' }}>
          {slides[current].subtitle}
        </p>

        {/* Dots + Arrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {slides.map((_, i) => (
              <div key={i} style={{
                width: i === current ? '22px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: i === current ? '#A8D83F' : '#3A3A50',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>
          <button
            onClick={handleNext}
            style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#A8D83F', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(168,216,63,0.4)' }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M4 11H18M18 11L11 4M18 11L11 18" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
