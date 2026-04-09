import React, { useState } from 'react';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import RideSelectScreen from './screens/RideSelectScreen';
import FindingDriverScreen from './screens/FindingDriverScreen';
import DriverFoundScreen from './screens/DriverFoundScreen';
import PaymentScreen from './screens/PaymentScreen';
import RatingScreen from './screens/RatingScreen';
import LoaderScreen from './screens/LoaderScreen';

type Screen =
  | 'loader'
  | 'onboarding'
  | 'home'
  | 'ride-select'
  | 'finding-driver'
  | 'driver-found'
  | 'payment'
  | 'rating';

interface Location {
  lat: number;
  lng: number;
  label: string;
}

// Screens that show a brief loader before transition
const LOADER_BEFORE: Partial<Record<Screen, number>> = {
  'finding-driver': 600,
  'driver-found': 400,
  'rating': 400,
};

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('onboarding');
  const [pickup, setPickup] = useState<Location>({ lat: 51.5074, lng: -0.1278, label: 'Current Location' });
  const [destination, setDestination] = useState<Location>({ lat: 51.51, lng: -0.105, label: 'Destination' });
  const [prevScreen, setPrevScreen] = useState<Screen>('home');
  const [loading, setLoading] = useState(false);

  const go = (next: Screen) => {
    const delay = LOADER_BEFORE[next];
    if (delay) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setScreen(next);
      }, delay);
    } else {
      setScreen(next);
    }
  };

  const handleSelectDestination = (p: Location, d: Location) => {
    setPickup(p);
    setDestination(d);
    go('ride-select');
  };

  const handleBook = (_rideType: string) => {
    go('finding-driver');
  };

  const handleOpenPayment = () => {
    setPrevScreen(screen);
    go('payment');
  };

  if (loading) return (
    <div className="app-shell">
      <LoaderScreen />
    </div>
  );

  return (
    <div className="app-shell">
      {screen === 'onboarding' && (
        <OnboardingScreen onDone={() => go('home')} />
      )}

      {screen === 'home' && (
        <HomeScreen
          onSelectDestination={handleSelectDestination}
          onOpenPayment={handleOpenPayment}
        />
      )}

      {screen === 'ride-select' && (
        <RideSelectScreen
          pickup={pickup}
          destination={destination}
          onBook={handleBook}
          onBack={() => go('home')}
        />
      )}

      {screen === 'finding-driver' && (
        <FindingDriverScreen
          pickup={pickup}
          destination={destination}
          onDriverFound={() => go('driver-found')}
          onCancel={() => go('home')}
        />
      )}

      {screen === 'driver-found' && (
        <DriverFoundScreen
          pickup={pickup}
          destination={destination}
          onArrived={() => go('rating')}
          onCancel={() => go('home')}
        />
      )}

      {screen === 'payment' && (
        <PaymentScreen
          onConfirm={() => go(prevScreen)}
          onBack={() => go(prevScreen)}
        />
      )}

      {screen === 'rating' && (
        <RatingScreen onDone={() => go('home')} />
      )}
    </div>
  );
};

export default App;
