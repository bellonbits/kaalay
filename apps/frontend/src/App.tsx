import React, { useState } from 'react';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import RideSelectScreen from './screens/RideSelectScreen';
import FindingDriverScreen from './screens/FindingDriverScreen';
import DriverFoundScreen from './screens/DriverFoundScreen';
import PaymentScreen from './screens/PaymentScreen';
import RatingScreen from './screens/RatingScreen';

type Screen =
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

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('onboarding');
  const [pickup, setPickup] = useState<Location>({ lat: 51.5074, lng: -0.1278, label: 'Current Location' });
  const [destination, setDestination] = useState<Location>({ lat: 51.51, lng: -0.105, label: 'Destination' });
  const [prevScreen, setPrevScreen] = useState<Screen>('home');

  const go = (s: Screen) => setScreen(s);

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
          onOpenPayment={handleOpenPayment}
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
