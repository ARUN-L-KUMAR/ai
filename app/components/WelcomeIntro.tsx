'use client';

import { useState } from 'react';
import { Sparkles, MapPin, Calendar, Users, Plane } from 'lucide-react';

interface WelcomeIntroProps {
  onQuickStart?: (query: string) => void;
}

export default function WelcomeIntro({ onQuickStart }: WelcomeIntroProps) {
  const [isVisible, setIsVisible] = useState(true);

  const quickStartOptions = [
    {
      icon: '🏔️',
      text: 'Adventure in Himachal',
      query: 'Show me adventure packages in Himachal Pradesh',
      gradient: 'from-blue-500 to-cyan-600'
    },
    {
      icon: '🏖️',
      text: 'Beach Getaway',
      query: 'Find beach packages in Goa',
      gradient: 'from-orange-500 to-pink-600'
    },
    {
      icon: '👨‍👩‍👧‍👦',
      text: 'Family Vacation',
      query: 'Show me family-friendly packages',
      gradient: 'from-green-500 to-teal-600'
    },
    {
      icon: '💕',
      text: 'Romantic Trip',
      query: 'Find romantic destinations for couples',
      gradient: 'from-purple-500 to-pink-600'
    }
  ];

  const features = [
    {
      icon: <MapPin className="w-5 h-5" />,
      title: 'Smart Destinations',
      desc: 'AI-powered recommendations'
    },
    {
      icon: <Calendar className="w-5 h-5" />,
      title: 'Custom Planning',
      desc: 'Personalized itineraries'
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: 'Group Travel',
      desc: 'Perfect for any group size'
    }
  ];

  if (!isVisible) return null;

  return (
    <div className="chat-message max-w-4xl">
      {/* AI Avatar and Header */}
      <div className="flex items-center mb-6">
        <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mr-4 shadow-lg animate-float">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Welcome to TripXplo AI ✈️</h2>
          <p className="text-sm text-gray-600">Your Partner in Smart Travel Planning</p>
        </div>
      </div>

      {/* Main Welcome Card */}
      <div className="bg-gradient-to-br from-white via-blue-50 to-purple-50 rounded-3xl p-6 border border-indigo-100 shadow-xl mb-6 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-full -translate-y-16 translate-x-16 opacity-20"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-br from-blue-200 to-cyan-200 rounded-full translate-y-12 -translate-x-12 opacity-20"></div>
        
        <div className="relative z-10">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3 animate-float">🌍</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Discover Your Perfect Journey
            </h3>
            <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">
              Ask me about destinations, packages, or travel tips. 
              I'll help you discover your perfect journey! ✨
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white/70 backdrop-blur rounded-xl p-4 border border-white/20 animate-slide-in hover:bg-white/90 transition-all duration-200"
                style={{ animationDelay: `${0.2 + index * 0.1}s` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
                    {feature.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm">{feature.title}</h4>
                    <p className="text-xs text-gray-600">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Start Options */}
          <div className="text-center">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-center gap-2">
              <span>🚀</span>
              Ready to plan your dream trip?
            </h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {quickStartOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => onQuickStart?.(option.query)}
                  className={`group bg-gradient-to-r ${option.gradient} text-white rounded-xl p-4 hover:shadow-lg transition-all duration-200 transform hover:scale-105 animate-fade-in`}
                  style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                >
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                    {option.icon}
                  </div>
                  <p className="text-sm font-medium">{option.text}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 rounded-2xl p-4 border border-amber-200 animate-fade-in" style={{ animationDelay: '0.8s' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm">💡</span>
          </div>
          <div>
            <h5 className="font-semibold text-amber-900 text-sm">Pro Tip</h5>
            <p className="text-amber-800 text-sm">
              Try: "Show me 5-day packages under ₹25,000" or "Best time to visit Kashmir?"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
