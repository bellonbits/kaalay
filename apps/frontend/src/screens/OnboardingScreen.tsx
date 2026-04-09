import React, { useState } from 'react';

interface Props {
  onDone: () => void;
}

const slides = [
  {
    image: '/onboarding3.png',
    bg: 'linear-gradient(160deg, #1A1A2E 0%, #2D2B55 100%)',
    imageBg: '#00C9B1',
    title: 'Request a ride, anytime',
    subtitle: 'Choose your destination by searching or dropping a pin on the map.',
  },
  {
    image: '/onboarding2.png',
    bg: 'linear-gradient(160deg, #0F2027 0%, #203A43 50%, #2C5364 100%)',
    imageBg: '#EEF2FF',
    title: 'Find nearby drivers',
    subtitle: 'We match you with the closest available driver in seconds.',
  },
  {
    image: '/get-started.png',
    bg: 'linear-gradient(160deg, #1A1A2E 0%, #16213E 100%)',
    imageBg: 'transparent',
    title: 'Ride in comfort',
    subtitle: 'Premium vehicles at fair prices — track your driver in real time.',
  },
];

const OnboardingScreen: React.FC<Props> = ({ onDone }) => {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];

  const handleNext = () => {
    if (current < slides.length - 1) setCurrent(current + 1);
    else onDone();
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: slide.bg, transition: 'background 0.5s ease' }}>

      {/* Image area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px 0', position: 'relative', overflow: 'hidden' }}>
        {/* Glow circle behind image */}
        <div style={{ position: 'absolute', width: '260px', height: '260px', borderRadius: '50%', background: slide.imageBg, opacity: 0.15, filter: 'blur(40px)' }} />
        <img
          src={slide.image}
          alt={slide.title}
          style={{
            width: '100%',
            maxWidth: current === 2 ? '100%' : '300px',
            height: current === 2 ? '100%' : 'auto',
            objectFit: current === 2 ? 'cover' : 'contain',
            borderRadius: current === 2 ? '24px' : '0',
            position: 'relative',
            zIndex: 1,
          }}
        />
      </div>

      {/* Bottom dark card */}
      <div style={{ background: '#1A1A2E', borderRadius: '28px 28px 0 0', padding: '32px 28px 48px', color: 'white', flexShrink: 0 }}>
        {/* Dots */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {slides.map((_, i) => (
            <div
              key={i}
              onClick={() => setCurrent(i)}
              style={{ width: i === current ? '22px' : '8px', height: '8px', borderRadius: '4px', background: i === current ? '#A8D83F' : '#3A3A50', transition: 'all 0.3s ease', cursor: 'pointer' }}
            />
          ))}
        </div>

        <h2 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '10px', lineHeight: 1.2, letterSpacing: '-0.5px' }}>
          {slide.title}
        </h2>
        <p style={{ fontSize: '14px', color: '#8E8E9A', lineHeight: 1.6, marginBottom: '32px' }}>
          {slide.subtitle}
        </p>

        {/* Dots indicator + Arrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button
            onClick={handleNext}
            style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#A8D83F', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(168,216,63,0.4)', transition: 'transform 0.1s' }}
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
