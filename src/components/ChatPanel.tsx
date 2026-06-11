import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage } from '../ai/llmStrategy';

interface ChatPanelProps {
  chats: ChatMessage[];
  onSend: (message: string) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ chats, onSend }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">💬 牌桌聊天</div>
      <div className="chat-messages">
        {chats.length === 0 && (
          <div className="chat-empty">暂无消息</div>
        )}
        {chats.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.playerId === -1 ? 'chat-own' : ''}`}>
            <span className="chat-name">{msg.playerName}</span>
            <span className="chat-text">{msg.content}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          ref={inputRef}
          className="chat-input"
          type="text"
          placeholder="说点什么..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={100}
        />
        <button className="chat-send-btn" onClick={handleSend}>发送</button>
      </div>
    </div>
  );
};

export default ChatPanel;
