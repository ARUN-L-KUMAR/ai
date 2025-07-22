'use client';

import { useState } from 'react';
import { Bot, User, Copy, ThumbsUp, ThumbsDown, Check, Calendar, MapPin, Users, DollarSign, Star } from 'lucide-react';
import TripCard from './TripCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  index?: number;
}

interface ChatMessageProps {
  message: Message;
  index?: number;
}

export default function ChatMessage({ message, index }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Function to parse trip packages from content
  const parsePackages = (content: string) => {
    const packageRegex = /\*\*(.*?)\*\*[\s\S]*?🏨\s*(.*?)\s*\|[\s\S]*?📍\s*(.*?)\s*\|[\s\S]*?⏰\s*(.*?)\s*\|[\s\S]*?💰\s*₹([\d,]+)/g;
    const packages = [];
    let match;

    while ((match = packageRegex.exec(content)) !== null) {
      packages.push({
        name: match[1].trim(),
        hotels: match[2].trim(),
        destination: match[3].trim(),
        duration: match[4].trim(),
        price: match[5].replace(/,/g, '')
      });
    }

    return packages;
  };

  // Function to render formatted content
  const renderContent = () => {
    let content = message.content;
    const packages = parsePackages(content);

    // If packages are found, render them as cards
    if (packages.length > 0 && !isUser) {
      // Remove the package details from content to avoid duplication
      const cleanContent = content.replace(/\*\*(.*?)\*\*[\s\S]*?💰\s*₹[\d,]+/g, '').trim();
      
      return (
        <div className="space-y-6">
          {cleanContent && (
            <div className="prose prose-sm max-w-none text-gray-700">
              {formatText(cleanContent)}
            </div>
          )}
          <div className="grid gap-4 mt-6">
            {packages.map((pkg, idx) => (
              <TripCard
                key={idx}
                name={pkg.name}
                destination={pkg.destination}
                duration={pkg.duration}
                price={parseInt(pkg.price)}
                hotels={pkg.hotels}
                imageUrl={`https://images.unsplash.com/800x600/?travel,${pkg.destination.toLowerCase().replace(/\s+/g, ',')}`}
              />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="prose prose-sm max-w-none text-gray-700">
        {formatText(content)}
      </div>
    );
  };

  // Function to format text with markdown-like syntax
  const formatText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.trim() === '') return <br key={idx} />;
      
      // Headers
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-lg font-semibold text-gray-900 mt-4 mb-2">{line.slice(3)}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-base font-medium text-gray-800 mt-3 mb-2">{line.slice(4)}</h3>;
      }
      
      // Bold text
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={idx} className="mb-2">
            {parts.map((part, partIdx) => 
              partIdx % 2 === 0 ? part : <strong key={partIdx} className="font-semibold text-gray-900">{part}</strong>
            )}
          </p>
        );
      }
      
      // Bullet points
      if (line.trim().startsWith('•')) {
        return <li key={idx} className="ml-4 mb-1 text-gray-700">{line.trim().slice(1).trim()}</li>;
      }
      
      // Regular text
      return <p key={idx} className="mb-2 text-gray-700">{line}</p>;
    });
  };

  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fadeIn`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 ${isUser ? 'ml-4' : 'mr-4'}`}>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
          isUser 
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600' 
            : 'bg-gradient-to-r from-indigo-600 to-purple-600'
        }`}>
          {isUser ? (
            <User className="w-5 h-5 text-white" />
          ) : (
            <Bot className="w-5 h-5 text-white" />
          )}
        </div>
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-4xl ${isUser ? 'text-right' : 'text-left'}`}>
        {/* Header with name and timestamp */}
        <div className={`flex items-center gap-2 mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-sm font-semibold text-gray-900">
              {isUser ? 'You' : 'TripXplo AI'}
            </span>
            {!isUser && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-500">Online</span>
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Message Bubble */}
        <div className={`relative group ${isUser ? 'ml-12' : 'mr-12'}`}>
          <div className={`p-6 rounded-3xl shadow-lg border ${
            isUser 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-100' 
              : 'bg-white/90 backdrop-blur text-gray-800 border-gray-100'
          }`}>
            {isUser ? (
              <p className="text-white leading-relaxed">{message.content}</p>
            ) : (
              renderContent()
            )}
          </div>

          {/* Action buttons for AI messages */}
          {!isUser && (
            <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={copyToClipboard}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-all flex items-center gap-1"
                title="Copy message"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
              </button>
              
              <button
                className="p-2 rounded-xl bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-600 transition-all"
                title="Good response"
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
              
              <button
                className="p-2 rounded-xl bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 transition-all"
                title="Poor response"
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
