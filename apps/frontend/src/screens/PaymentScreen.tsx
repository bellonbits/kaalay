import React, { useState } from 'react';
import { UserOutlined, CreditCardOutlined, CalendarOutlined, ArrowLeftOutlined } from '@ant-design/icons';

interface Props {
  onConfirm: () => void;
  onBack: () => void;
}

const PaymentScreen: React.FC<Props> = ({ onConfirm, onBack }) => {
  const [cardNumber, setCardNumber] = useState('7513 8752 8764 5964');
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('06 / 27');
  const [cvv, setCvv] = useState('');

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + ' / ' + digits.slice(2);
    return digits;
  };

  const fieldRow = (icon: React.ReactNode, content: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F8F8FC', borderRadius: '14px', padding: '14px 16px', marginBottom: '14px' }}>
      <div style={{ fontSize: '18px', color: '#8E8E9A', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      {content}
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--purple)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: 'white', borderRadius: '28px 28px 0 0', padding: '28px 24px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
            <ArrowLeftOutlined style={{ fontSize: '20px', color: '#1C1C2E' }} />
          </button>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#F0EEFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCardOutlined style={{ fontSize: '22px', color: '#7B61FF' }} />
          </div>
          <div style={{ width: '28px' }} />
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: '700', textAlign: 'center', marginBottom: '6px' }}>Add payment card</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-gray)', textAlign: 'center', marginBottom: '24px', lineHeight: 1.5 }}>
          By adding card, I accept the <span style={{ color: 'var(--purple)', fontWeight: '600' }}>Terms of Service</span> and have read <span style={{ color: 'var(--purple)', fontWeight: '600' }}>Privacy Policy.</span>
        </p>

        {/* Name */}
        {fieldRow(
          <UserOutlined />,
          <input
            className="input-field"
            style={{ background: 'transparent', border: 'none', padding: 0, flex: 1 }}
            placeholder="Cardholder name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        )}

        {/* Card number */}
        {fieldRow(
          <CreditCardOutlined />,
          <input
            className="input-field"
            style={{ background: 'transparent', border: 'none', padding: 0, flex: 1 }}
            placeholder="Card number"
            value={cardNumber}
            onChange={e => setCardNumber(formatCardNumber(e.target.value))}
            inputMode="numeric"
          />
        )}

        {/* Expiry + CVV */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', background: '#F8F8FC', borderRadius: '14px', padding: '14px 16px' }}>
            <CalendarOutlined style={{ fontSize: '18px', color: '#8E8E9A', flexShrink: 0 }} />
            <input
              className="input-field"
              style={{ background: 'transparent', border: 'none', padding: 0, flex: 1 }}
              placeholder="MM / YY"
              value={expiry}
              onChange={e => setExpiry(formatExpiry(e.target.value))}
              inputMode="numeric"
            />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', background: '#F8F8FC', borderRadius: '14px', padding: '14px 16px' }}>
            <input
              className="input-field"
              style={{ background: 'transparent', border: 'none', padding: 0, flex: 1 }}
              placeholder="CVV"
              value={cvv}
              onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric"
              type="password"
            />
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-outline" style={{ flex: 1 }} onClick={onBack}>
            Scan card
          </button>
          <button className="btn-green" style={{ flex: 1 }} onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentScreen;
