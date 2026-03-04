-- Add UPDATE and DELETE policies to whatsapp_messages (#116)
-- Existing policies only cover SELECT and INSERT.

CREATE POLICY "Users can update messages in own conversations"
  ON whatsapp_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations
      WHERE whatsapp_conversations.id = whatsapp_messages.conversation_id
      AND whatsapp_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in own conversations"
  ON whatsapp_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations
      WHERE whatsapp_conversations.id = whatsapp_messages.conversation_id
      AND whatsapp_conversations.user_id = auth.uid()
    )
  );
