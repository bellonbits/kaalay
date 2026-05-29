'use client';
import { useState, useRef, useEffect } from 'react';
import { useGoogleMaps } from './GoogleMapsProvider';
import { EnvironmentOutlined, CarOutlined, SearchOutlined, SwapOutlined, LoadingOutlined, ArrowLeftOutlined, CloseOutlined, AimOutlined } from '@ant-design/icons';
import { convertToCoordinates, searchPlaces } from '../lib/api';
import { useCallback } from 'react';


export interface LocationPoint {
  lat: number;
  lng: number;
  label: string;
  isW3W?: boolean;
}

interface Props {
  isVisible: boolean;
  currentLocation?: { lat: number; lng: number };
  initialStartPoint?: LocationPoint | null;
  initialDestPoint?: LocationPoint | null;
  onRouteSubmit: (start: LocationPoint, dest: LocationPoint) => void;
  onClose: () => void;
  onPickOnMapStart?: () => void;
  onPickOnMapDest?: () => void;
}

export default function NavigationSheet({ 
  isVisible, 
  currentLocation, 
  initialStartPoint, 
  initialDestPoint, 
  onRouteSubmit, 
  onClose,
  onPickOnMapStart,
  onPickOnMapDest
}: Props) {
  const { isLoaded } = useGoogleMaps();
  
  const [startQuery, setStartQuery] = useState(initialStartPoint?.label || '');
  const [destQuery, setDestQuery] = useState(initialDestPoint?.label || '');
  
  const [startPoint, setStartPoint] = useState<LocationPoint | null>(initialStartPoint || null);
  const [destPoint, setDestPoint] = useState<LocationPoint | null>(initialDestPoint || null);
  const [w3wSuggestions, setW3wSuggestions] = useState<any[]>([]);
  const [customStartSuggestions, setCustomStartSuggestions] = useState<any[]>([]);
  const [customDestSuggestions, setCustomDestSuggestions] = useState<any[]>([]);
  const [startGoogleSuggestions, setStartGoogleSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [destGoogleSuggestions, setDestGoogleSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  
  const [loadingW3W, setLoadingW3W] = useState(false);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (isLoaded && window.google?.maps?.places) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
  }, [isLoaded]);

  const fetchGoogleSuggestions = useCallback(async (input: string, callback: (predictions: google.maps.places.AutocompletePrediction[]) => void) => {
    if (!input || input.length < 2 || input.includes('.') || input.startsWith('///')) {
      callback([]);
      return;
    }
    try {
      const { suggestions } = await (google.maps.places.AutocompleteSuggestion as any).fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current || undefined,
      });
      const predictions = (suggestions || []).map((s: any) => s.placePrediction).filter(Boolean).map((p: any) => ({
        place_id: p.placeId,
        description: p.text?.text || '',
        structured_formatting: {
          main_text: p.structuredFormat?.mainText?.text || p.text?.text || '',
          secondary_text: p.structuredFormat?.secondaryText?.text || '',
        },
      }));
      callback(predictions);
    } catch {
      callback([]);
    }
  }, []);

  const handleSelectGooglePlace = useCallback((prediction: google.maps.places.AutocompletePrediction, setPoint: (p: LocationPoint) => void, setQuery: (q: string) => void) => {
    setQuery(prediction.description);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ placeId: prediction.place_id }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        setPoint({
          lat: loc.lat(),
          lng: loc.lng(),
          label: prediction.description,
        });
        if (window.google?.maps?.places?.AutocompleteSessionToken) {
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        }
      }
    });
  }, []);

  const lastStartRef = useRef<LocationPoint | null | undefined>(initialStartPoint);
  const lastDestRef = useRef<LocationPoint | null | undefined>(initialDestPoint);

  // Synchronize with external changes (e.g. from map picking) with value-based comparison
  useEffect(() => {
    const hasChanged = 
      (!initialStartPoint && lastStartRef.current) ||
      (initialStartPoint && !lastStartRef.current) ||
      (initialStartPoint && lastStartRef.current && (
        initialStartPoint.lat !== lastStartRef.current.lat ||
        initialStartPoint.lng !== lastStartRef.current.lng ||
        initialStartPoint.label !== lastStartRef.current.label
      ));

    if (hasChanged) {
      lastStartRef.current = initialStartPoint;
      if (initialStartPoint) {
        setStartPoint(initialStartPoint);
        setStartQuery(initialStartPoint.label);
      } else {
        setStartPoint(null);
        setStartQuery('');
      }
    }
  }, [initialStartPoint]);

  useEffect(() => {
    const hasChanged = 
      (!initialDestPoint && lastDestRef.current) ||
      (initialDestPoint && !lastDestRef.current) ||
      (initialDestPoint && lastDestRef.current && (
        initialDestPoint.lat !== lastDestRef.current.lat ||
        initialDestPoint.lng !== lastDestRef.current.lng ||
        initialDestPoint.label !== lastDestRef.current.label
      ));

    if (hasChanged) {
      lastDestRef.current = initialDestPoint;
      if (initialDestPoint) {
        setDestPoint(initialDestPoint);
        setDestQuery(initialDestPoint.label);
      } else {
        setDestPoint(null);
        setDestQuery('');
      }
    }
  }, [initialDestPoint]);

  // Use "My Location" if `currentLocation` exists and `startPoint` is null
  const effectiveStart = startPoint ?? (currentLocation ? { ...currentLocation, label: 'Your Current Location' } : null);

  const isW3W = (str: string) => /^\/{0,2}[a-z]+\.[a-z]+\.[a-z]+$/i.test(str.trim());

  const checkW3W = async (query: string, setPoint: (p: LocationPoint) => void) => {
    if (isW3W(query)) {
      setLoadingW3W(true);
      try {
        const { latitude, longitude, what3words } = await convertToCoordinates(query);
        setPoint({ lat: latitude, lng: longitude, label: `///${what3words}`, isW3W: true });
      } catch (err) {
        console.error("what3words conversion failed", err);
      } finally {
        setLoadingW3W(false);
      }
    }
  };

  const handleStartChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStartQuery(val);
    if (startPoint) setStartPoint(null);
    if (val.length >= 2) {
      try {
        const res = await searchPlaces(val);
        setCustomStartSuggestions(res || []);
      } catch {
        setCustomStartSuggestions([]);
      }
      fetchGoogleSuggestions(val, setStartGoogleSuggestions);
    } else {
      setCustomStartSuggestions([]);
      setStartGoogleSuggestions([]);
    }
  };

  const handleStartBlur = () => { 
    setTimeout(() => {
      setCustomStartSuggestions([]);
      setStartGoogleSuggestions([]);
    }, 200);
    checkW3W(startQuery, setStartPoint); 
  };

  const handleDestBlur = () => { 
    setTimeout(() => {
      setW3wSuggestions([]);
      setCustomDestSuggestions([]);
      setDestGoogleSuggestions([]);
    }, 200);
    checkW3W(destQuery, setDestPoint); 
  };

  const submitRoute = () => {
    if (effectiveStart && destPoint) onRouteSubmit(effectiveStart, destPoint);
  };

  // Auto-submit instantly when both points are ready (Uber-like flow)
  useEffect(() => {
    if (effectiveStart && destPoint) {
      // Small timeout to allow the input to visibly populate before the sheet closes
      const t = setTimeout(() => {
        onRouteSubmit(effectiveStart, destPoint);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [effectiveStart, destPoint, onRouteSubmit]);

  return (
    <div className={`fixed inset-0 z-[60] bg-[#F8F9FA] flex flex-col transition-all duration-500 ease-in-out ${isVisible ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-10'}`}>
      {/* Premium Header Container */}
      <div className="bg-white px-6 pt-16 pb-8 shadow-sheet z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose} 
              className="w-10 h-10 glass rounded-xl flex items-center justify-center active:scale-90 transition-transform"
            >
              <ArrowLeftOutlined className="text-black" />
            </button>
            <h2 className="text-xl font-black text-black tracking-tight">Plan Journey</h2>
          </div>
          <div className="px-3 py-1 bg-yellow-400 rounded-lg">
            <span className="text-[10px] font-black uppercase tracking-widest text-black">Precision GPS</span>
          </div>
        </div>

        {/* Journey Inputs Section */}
        <div className="flex gap-4 relative">
          {/* Vertical Timeline Graphic */}
          <div className="flex flex-col items-center pt-6">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-black bg-white" />
            <div className="w-0.5 h-14 border-l-2 border-dashed border-gray-200 my-1" />
            <div className="w-2.5 h-2.5 bg-yellow-400" />
          </div>

          <div className="flex-1 space-y-3">
            {/* Start Point Input */}
            <div className="relative">
              {!isLoaded ? <LoadingOutlined className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" /> :
                <>
                  <div className="input-container !bg-gray-50 !h-14 flex items-center justify-between pr-3">
                    <input
                      placeholder="Current Location"
                      value={startPoint?.label ?? startQuery}
                      onChange={handleStartChange}
                      onBlur={handleStartBlur}
                      className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-black placeholder:text-gray-300"
                    />
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onPickOnMapStart?.();
                      }}
                      className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center active:scale-90 transition-transform flex-shrink-0 ml-2 border border-gray-100"
                      title="Choose on Map"
                    >
                      <AimOutlined className="text-[#8E2DE2] text-sm" />
                    </button>
                  </div>

                  {/* Start Suggestions Dropdown */}
                  {(customStartSuggestions.length > 0 || startGoogleSuggestions.length > 0) && (
                    <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-2xl shadow-premium border border-gray-100 z-50 overflow-hidden animate-fade-in max-h-80 overflow-y-auto no-scroll">
                      {customStartSuggestions.length > 0 && (
                        <>
                          <div className="px-5 py-2.5 bg-purple-50/50 border-b border-gray-50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#8E2DE2]">Saved Custom Places</span>
                          </div>
                          {customStartSuggestions.map((s: any, i: number) => (
                            <button 
                              key={`custom-start-${i}`}
                              onClick={() => {
                                setStartQuery(s.name);
                                setStartPoint({ lat: s.latitude, lng: s.longitude, label: s.name });
                                setCustomStartSuggestions([]);
                              }}
                              className="w-full px-5 py-4 flex items-center gap-4 text-left active:bg-gray-50 border-b border-gray-100 last:border-none transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                                <EnvironmentOutlined className="text-[#8E2DE2] text-sm" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-black leading-none mb-1">{s.name}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">///{s.words} · {s.description || 'Saved location'}</p>
                              </div>
                            </button>
                          ))}
                        </>
                      )}

                      {startGoogleSuggestions.length > 0 && (
                        <>
                          <div className="px-5 py-2.5 bg-blue-50/50 border-b border-gray-50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#000080]">Search Results</span>
                          </div>
                          {startGoogleSuggestions.map((s) => (
                            <button 
                              key={s.place_id}
                              onClick={() => {
                                handleSelectGooglePlace(s, setStartPoint, setStartQuery);
                                setStartGoogleSuggestions([]);
                              }}
                              className="w-full px-5 py-4 flex items-center gap-4 text-left active:bg-gray-50 border-b border-gray-100 last:border-none transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <EnvironmentOutlined className="text-[#000080] text-sm" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-black truncate leading-tight">{s.structured_formatting.main_text}</p>
                                <p className="text-xs text-gray-400 truncate mt-1">{s.structured_formatting.secondary_text}</p>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </>
              }
            </div>
            
            {/* Destination Point Input */}
            <div className="relative">
              {!isLoaded ? <LoadingOutlined className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" /> :
                <>
                  <div className="input-container !bg-gray-50 !h-14 !border-yellow-400/30 flex items-center justify-between pr-3">
                    <input
                      autoFocus
                      placeholder="Where to? (e.g. filled.count.soap)"
                      value={destQuery}
                      onChange={async (e) => {
                        const val = e.target.value;
                        setDestQuery(val);
                        if (destPoint) setDestPoint(null);
                        
                        // Custom Places search
                        if (val.length >= 2) {
                          try {
                            const res = await searchPlaces(val);
                            setCustomDestSuggestions(res || []);
                          } catch {
                            setCustomDestSuggestions([]);
                          }
                          fetchGoogleSuggestions(val, setDestGoogleSuggestions);
                        } else {
                          setCustomDestSuggestions([]);
                          setDestGoogleSuggestions([]);
                        }

                        if (val.includes('.') || val.startsWith('///')) {
                          try {
                            const res = await (await import('../lib/api')).autosuggest(val, currentLocation);
                            setW3wSuggestions(res.suggestions || []);
                          } catch {
                            setW3wSuggestions([]);
                          }
                        } else {
                          setW3wSuggestions([]);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setW3wSuggestions([]);
                          setCustomDestSuggestions([]);
                          setDestGoogleSuggestions([]);
                        }, 200);
                        handleDestBlur();
                      }}
                      className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-black placeholder:text-gray-300"
                    />
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onPickOnMapDest?.();
                      }}
                      className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center active:scale-90 transition-transform flex-shrink-0 ml-2 border border-gray-100"
                      title="Choose on Map"
                    >
                      <AimOutlined className="text-yellow-400 text-sm" />
                    </button>
                  </div>

                  {/* Suggestions Dropdown (Custom Places, W3W & Google Suggestions) */}
                  {(customDestSuggestions.length > 0 || w3wSuggestions.length > 0 || destGoogleSuggestions.length > 0) && (
                    <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-2xl shadow-premium border border-gray-100 z-50 overflow-hidden animate-fade-in max-h-80 overflow-y-auto no-scroll">
                      {customDestSuggestions.length > 0 && (
                        <>
                          <div className="px-5 py-2.5 bg-purple-50/50 border-b border-gray-50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#8E2DE2]">Saved Custom Places</span>
                          </div>
                          {customDestSuggestions.map((s: any, i: number) => (
                            <button 
                              key={`custom-dest-${i}`}
                              onClick={() => {
                                setDestQuery(s.name);
                                setDestPoint({ lat: s.latitude, lng: s.longitude, label: s.name });
                                setCustomDestSuggestions([]);
                              }}
                              className="w-full px-5 py-4 flex items-center gap-4 text-left active:bg-gray-50 border-b border-gray-100 last:border-none transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                                <EnvironmentOutlined className="text-[#8E2DE2] text-sm" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-black leading-none mb-1">{s.name}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">///{s.words} · {s.description || 'Saved location'}</p>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                      
                      {w3wSuggestions.length > 0 && (
                        <>
                          <div className="px-5 py-2.5 bg-red-50/30 border-b border-gray-50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">What3Words Addresses</span>
                          </div>
                          {w3wSuggestions.map((s: any, i: number) => (
                            <button 
                              key={`w3w-${i}`}
                              onClick={async () => {
                                setDestQuery(`///${s.words}`);
                                setW3wSuggestions([]);
                                setLoadingW3W(true);
                                try {
                                  const { latitude, longitude } = await (await import('../lib/api')).convertToCoordinates(s.words);
                                  setDestPoint({ lat: latitude, lng: longitude, label: `///${s.words}`, isW3W: true });
                                } finally {
                                  setLoadingW3W(false);
                                }
                              }}
                              className="w-full px-5 py-4 flex items-center gap-4 text-left active:bg-gray-50 border-b border-gray-100 last:border-none transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                                <EnvironmentOutlined className="text-red-500 text-sm" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-red-600 leading-none mb-1">///{s.words}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.nearestPlace}</p>
                              </div>
                            </button>
                          ))}
                        </>
                      )}

                      {destGoogleSuggestions.length > 0 && (
                        <>
                          <div className="px-5 py-2.5 bg-blue-50/50 border-b border-gray-50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#000080]">Search Results</span>
                          </div>
                          {destGoogleSuggestions.map((s) => (
                            <button 
                              key={s.place_id}
                              onClick={() => {
                                handleSelectGooglePlace(s, setDestPoint, setDestQuery);
                                destGoogleSuggestions.length = 0; // Clear
                              }}
                              className="w-full px-5 py-4 flex items-center gap-4 text-left active:bg-gray-50 border-b border-gray-100 last:border-none transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <EnvironmentOutlined className="text-[#000080] text-sm" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-black truncate leading-tight">{s.structured_formatting.main_text}</p>
                                <p className="text-xs text-gray-400 truncate mt-1">{s.structured_formatting.secondary_text}</p>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </>
              }
              {loadingW3W && <LoadingOutlined className="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-500" />}
            </div>
          </div>
          
          <button className="absolute -right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform z-20">
            <SwapOutlined rotate={90} className="text-gray-400 text-xs" />
          </button>
        </div>
      </div>

      {/* Helper Content */}
      <div className="flex-1 px-6 py-10 overflow-y-auto no-scroll">
        <div className="bg-gray-100/50 p-6 rounded-[28px] border border-gray-50 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
              <EnvironmentOutlined className="text-yellow-400 text-sm" />
            </div>
            <h3 className="text-sm font-black text-black uppercase tracking-wider">Precision Picking</h3>
          </div>
          <p className="text-xs font-bold text-gray-500 leading-relaxed">
            Kaalay uses <span className="text-red-500">what3words</span> to give you an exact 3m x 3m pickup and dropoff point. 
            No more "near the shop" or "after the bridge".
          </p>
        </div>
      </div>

      {/* Sticky Action Footer Removed for Auto-Submit Flow */}
    </div>
  );
}
