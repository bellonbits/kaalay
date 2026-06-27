# Kaalay Super App - Frontend Redesign
## Complete Implementation Structure

### 📁 Folder Structure

```
apps/frontend/
├── app/
│   ├── (home)/
│   │   ├── page.tsx              # New premium homepage
│   │   └── layout.tsx
│   ├── (delivery)/
│   │   ├── page.tsx              # Suqafuran Express landing
│   │   ├── stores/
│   │   │   ├── page.tsx          # Store selection
│   │   │   └── [storeId]/
│   │   │       ├── page.tsx      # Store detail
│   │   │       └── product/
│   │   │           └── [id]/page.tsx
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx
│   │   └── tracking/[orderId]/page.tsx
│   ├── (marketplace)/
│   │   ├── page.tsx              # Marketplace browse
│   │   ├── product/[id]/page.tsx
│   │   └── cart/page.tsx
│   ├── (driver)/
│   │   ├── dashboard/page.tsx
│   │   ├── offer/page.tsx
│   │   ├── delivery/page.tsx
│   │   └── earnings/page.tsx
│   ├── (store)/
│   │   ├── dashboard/page.tsx
│   │   ├── orders/page.tsx
│   │   └── products/page.tsx
│   └── (chat)/
│       ├── page.tsx
│       └── [conversationId]/page.tsx
├── components/
│   ├── ui/                       # Base UI components (existing)
│   ├── layouts/
│   │   ├── MainLayout.tsx
│   │   ├── BottomNav.tsx
│   │   └── Header.tsx
│   ├── home/
│   │   ├── HeroSection.tsx
│   │   ├── QuickActions.tsx
│   │   ├── NearbyStores.tsx
│   │   ├── PopularRestaurants.tsx
│   │   └── PromoBanner.tsx
│   ├── delivery/
│   │   ├── CategoryGrid.tsx
│   │   ├── StoreCard.tsx
│   │   ├── StoreHero.tsx
│   │   ├── ProductCard.tsx
│   │   └── CheckoutForm.tsx
│   ├── tracking/
│   │   ├── LiveMap.tsx
│   │   ├── TrackingTimeline.tsx
│   │   ├── DriverCard.tsx
│   │   └── ChatButton.tsx
│   ├── driver/
│   │   ├── OfferCard.tsx
│   │   ├── ActiveDeliveryMap.tsx
│   │   ├── EarningsCard.tsx
│   │   └── PerformanceStats.tsx
│   └── animations/
│       ├── PageTransition.tsx
│       ├── CardHover.tsx
│       └── MapMarker.tsx
├── lib/
│   ├── theme.ts                  # Design system
│   ├── hooks/
│   │   ├── useDelivery.ts
│   │   ├── useTracking.ts
│   │   ├── useDriver.ts
│   │   └── useCart.ts
│   ├── store/                    # Zustand state
│   │   ├── cartStore.ts
│   │   ├── deliveryStore.ts
│   │   └── userStore.ts
│   └── api/
│       ├── orders.ts
│       ├── tracking.ts
│       ├── drivers.ts
│       └── stores.ts
├── styles/
│   ├── globals.css               # Tailwind + animations
│   └── animations.css
└── types/
    ├── delivery.ts
    ├── order.ts
    ├── driver.ts
    └── tracking.ts
```

### 🎨 Design System Components

- ✅ Colors (primary green, backgrounds, text)
- ✅ Spacing & border radius
- ✅ Typography scale
- ✅ Shadows & elevation
- ✅ Transitions & animations

### 📄 Pages to Build

1. **Home (Premium Dashboard)**
   - Good morning greeting
   - Search bar
   - Quick action cards (Ride, Delivery, Shop, Send Package)
   - Nearby stores carousel
   - Popular restaurants section
   - Promo banners

2. **Suqafuran Express Delivery**
   - Landing page
   - Category grid (Restaurants, Groceries, Pharmacy, etc.)
   - Store selection with nearby stores
   - Store detail page with products
   - Cart & checkout
   - Delivery details form
   - Live tracking

3. **Marketplace**
   - Browse products
   - Product detail with images & sizing
   - Add to cart
   - Cart review
   - Checkout

4. **Live Tracking**
   - Animated map with driver movement
   - Timeline (Order → Preparing → Picked Up → On Way → Delivered)
   - Driver info card
   - Chat & call buttons
   - ETA countdown

5. **Driver Dashboard**
   - Online status toggle
   - Today's earnings
   - Completed deliveries
   - Performance score
   - Incoming request modal (full-screen)
   - Active delivery screen
   - Earnings history

6. **Store Dashboard**
   - Orders management
   - Revenue charts
   - Product inventory
   - Analytics

7. **Messaging**
   - Unified chat inbox
   - Chat with customer/merchant/driver
   - Image sharing
   - Typing indicators
   - Read receipts

### 🎬 Animations

- Page transitions (Framer Motion)
- Card hover effects
- Bottom sheet slides
- Map marker smooth movement
- Notification animations
- Loading spinners
- Skeleton loaders

### 🔌 API Integration

Uses existing backend services:
- Auth Service → /api/v1/auth
- Order Service → /api/v1/orders
- Dispatch Service → /api/v1/dispatch
- Driver Service → /api/v1/drivers
- Tracking Service → /api/v1/tracking (WebSocket)
- Messaging Service → /api/v1/messages
- Payment Service → /api/v1/payments

### 📱 Responsive Design

- Mobile-first approach
- Tablet layouts
- Desktop responsive
- Full-screen modals for mobile
- Bottom sheets for mobile actions
- Sticky headers/footers

### ✨ Key Features

- Premium visual hierarchy
- Spacious, minimal design
- Fast animations
- Smooth transitions
- Live map integration
- Real-time updates
- Push notifications
- Offline support (cached)

---

## Implementation Phases

**Phase 1:** Home page + design system
**Phase 2:** Delivery flow (landing → store → checkout)
**Phase 3:** Marketplace & cart
**Phase 4:** Live tracking & driver dashboard
**Phase 5:** Messaging & store dashboard
**Phase 6:** Animations & polish
