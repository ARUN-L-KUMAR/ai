'use client';

import React, { useState } from 'react';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Generate AI welcome message on component mount
  React.useEffect(() => {
    if (!isInitialized) {
      generateWelcomeMessage();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  const generateWelcomeMessage = async () => {
    // Show typing indicator
    setMessages([{ role: 'assistant', content: '' }]);
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/welcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      const welcomeMessage = data.message || "Hello! I'm TripXplo AI, your travel assistant. I can help you find amazing travel packages and plan your trips. What kind of adventure are you looking for?";
      
      setIsLoading(false);
      setMessages([{ role: 'assistant', content: welcomeMessage }]);
    } catch (error) {
      setIsLoading(false);
      setMessages([{ role: 'assistant', content: "Output only the final welcome message for TripXplo AI without any explanation, prefix, or extra text. Include a friendly greeting with emojis, say “Here are some ways I can help:”, then list exactly 5 bullet points (packages by destination, pricing details, browse by interests, explore destinations, find hotels/activities), and end with “What would you like to explore today?”" }]);
    }
  };
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (content: string) => {
    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage]
        }),
      });

      const data = await response.json();
      
      if (data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I\'m having trouble connecting. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">TripXplo AI</h1>
        <p className="text-gray-600">Your intelligent travel assistant</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}
        
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <ChatInput onSendMessage={sendMessage} disabled={isLoading} />
    </div>
  );
}