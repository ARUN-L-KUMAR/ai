'use client';

import { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import WelcomeIntro from './WelcomeIntro';
import { Bot, Sparkles, MapPin, Globe, Heart } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isWelcome?: boolean;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleQuickStart = (query: string) => {
    setShowWelcome(false);
    handleSendMessage(query);
  };

  const handleSendMessage = async (content: string) => {
    if (showWelcome) {
      setShowWelcome(false);
    }

    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || '� **Service Briefly Offline**\n\nPlease try again in a moment!\n\n✨ *Amazing trips are worth the wait* 🌟',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: '🔌 **Connection Interrupted** 🔌\n\n## 🎯 Network Connectivity Issue\n\nI\'m experiencing difficulty connecting to our travel intelligence database. This is typically a brief network interruption.\n\n### 🛠️ **Recommended Actions:**\n\n• **🔄 Page Refresh** - Reload the application\n• **📝 Retry Request** - Rephrase your travel query  \n• **🌐 Network Check** - Verify your internet connection\n• **⏰ Brief Wait** - Network issues often resolve quickly\n\n### 📞 **Alternative Options:**\n• Contact our travel consultants directly\n• Visit our website for destination guides\n• Check back in a few minutes\n\n**I\'ll be back to crafting perfect travel experiences shortly!** ✨\n\n*TripXplo AI - Your Premium Travel Intelligence*',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-r from-blue-200/30 to-purple-200/30 rounded-full blur-3xl animate-float"></div>
        <div className="absolute top-1/2 right-20 w-96 h-96 bg-gradient-to-r from-indigo-200/20 to-pink-200/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-gradient-to-r from-purple-200/25 to-blue-200/25 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-20 glass-effect">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Bot className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white pulse-dot"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">TripXplo AI</h1>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  Your Intelligent Travel Partner
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="hidden md:flex items-center gap-8 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Globe className="w-4 h-4 text-blue-500" />
                <span className="font-medium">500+ Destinations</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4 text-indigo-500" />
                <span className="font-medium">Custom Itineraries</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Heart className="w-4 h-4 text-pink-500" />
                <span className="font-medium">Expert Curated</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="relative z-10">
        <div className="max-w-6xl mx-auto px-4 py-8 min-h-[calc(100vh-140px)]">
          {/* Welcome Section */}
          {showWelcome && (
            <div className="mb-8">
              <WelcomeIntro onQuickStart={handleQuickStart} />
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="space-y-8 mb-8">
              {messages.map((message, index) => (
                <ChatMessage key={index} message={message} index={index} />
              ))}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-start mb-8">
              <div className="max-w-4xl">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                    <Sparkles className="w-6 h-6 text-white animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">TripXplo AI</h4>
                    <p className="text-sm text-gray-600">Crafting your perfect travel experience...</p>
                  </div>
                </div>
                <div className="bg-white/90 backdrop-blur rounded-3xl p-6 shadow-xl border border-indigo-100">
                  <div className="flex items-center gap-4">
                    <div className="typing-indicator">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                    <div>
                      <p className="text-gray-700 font-medium">Searching our travel database...</p>
                      <p className="text-sm text-gray-500">Finding the best packages, destinations & deals</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="sticky bottom-0 z-20 bg-gradient-to-t from-white via-white/95 to-transparent pt-6 pb-4">
          <div className="max-w-6xl mx-auto px-4">
            <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
