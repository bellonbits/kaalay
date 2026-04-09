import React, { useState } from 'react';
import { Input, Spin, message } from 'antd';
import { MapPin, Search } from 'lucide-react';
import api from '../api/client';

interface LocationPickerProps {
  label: string;
  placeholder: string;
  onSelect: (data: { lat: number; lng: number; words: string }) => void;
}

const LocationPicker: React.FC<LocationPickerProps> = ({ label, placeholder, onSelect }) => {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (val: string) => {
    setValue(val);
    
    // what3words format is word.word.word
    const w3wRegex = /^[a-z]+\.[a-z]+\.[a-z]+$/i;
    if (w3wRegex.test(val)) {
      setLoading(true);
      try {
        const response = await api.get(`/location/convert-to-coordinates?words=${val}`);
        const { latitude, longitude, what3words } = response.data;
        onSelect({ lat: latitude, lng: longitude, words: what3words });
        message.success(`Location identified: ///${what3words}`);
      } catch (err) {
        // Silently fail or show error if user finished typing
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#7f8c8d' }}>
        {label}
      </label>
      <Input
        prefix={loading ? <Spin size="small" /> : <MapPin size={16} color="#f7b731" />}
        suffix={<Search size={16} color="#7f8c8d" />}
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleSearch(e.target.value)}
        className="premium-input"
        style={{
          borderRadius: '12px',
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#fff'
        }}
      />
      {value && !loading && !value.includes('.') && (
        <div style={{ fontSize: '11px', color: '#f7b731', marginTop: '4px' }}>
          Format: word.word.word (e.g. filled.count.soap)
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
