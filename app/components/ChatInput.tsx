'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-4 p-6 bg-white/80 backdrop-blur-sm border-t border-gray-200/50 shadow-lg">
      <div className="flex-1 relative">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask about travel packages, destinations, pricing, or anything travel-related..."
          disabled={disabled}
          className="w-full px-6 py-4 pr-16 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 placeholder-gray-500 text-lg bg-white shadow-lg transition-all duration-200"
        />
        <div className="absolute right-5 top-1/2 transform -translate-y-1/2">
          <span className="text-2xl">✈️</span>
        </div>
      </div>
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className="px-8 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 font-bold shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 text-lg"
      >
        <Send size={20} />
        Send
      </button>
    </form>
  );
}