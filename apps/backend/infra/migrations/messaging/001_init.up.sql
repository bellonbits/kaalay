-- Messaging Service Schema

-- Conversations (customer↔driver, customer↔merchant, merchant↔driver)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- customer_driver, customer_merchant, merchant_driver
  participant_ids UUID[] NOT NULL,
  order_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conversations_order_id ON conversations(order_id);
CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_is_active ON conversations(is_active);
CREATE INDEX idx_conversations_participant_ids ON conversations USING GIN(participant_ids);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_name VARCHAR(255),
  content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- text, image, system
  image_url TEXT,
  read_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_read_at ON messages(read_at);

-- Typing Indicators (real-time "user is typing" state)
CREATE TABLE IF NOT EXISTS typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  typing_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '3 seconds')
);

CREATE INDEX idx_typing_indicators_conversation_id ON typing_indicators(conversation_id);
CREATE INDEX idx_typing_indicators_user_id ON typing_indicators(user_id);
CREATE INDEX idx_typing_indicators_expires_at ON typing_indicators(expires_at);

-- Message Read Receipts (tracks who read what)
CREATE TABLE IF NOT EXISTS read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reader_id UUID NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_read_receipts_message_id ON read_receipts(message_id);
CREATE INDEX idx_read_receipts_reader_id ON read_receipts(reader_id);
CREATE UNIQUE INDEX idx_read_receipts_unique ON read_receipts(message_id, reader_id);

-- Conversation Participants (denormalized for easier queries)
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name VARCHAR(255),
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE UNIQUE INDEX idx_conversation_participants_unique ON conversation_participants(conversation_id, user_id);
