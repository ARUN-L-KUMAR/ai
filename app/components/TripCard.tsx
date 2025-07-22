'use client';

import { Calendar, MapPin, Users, DollarSign, Star, Heart, Share, Camera } from 'lucide-react';
import { useState } from 'react';

interface TripCardProps {
  name: string;
  destination: string;
  duration: string;
  price: number;
  hotels?: string;
  imageUrl?: string;
  rating?: number;
  reviews?: number;
}

export default function TripCard({ 
  name, 
  destination, 
  duration, 
  price, 
  hotels, 
  imageUrl,
  rating = 4.5,
  reviews = 124
}: TripCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const getDestinationEmoji = (dest: string) => {
    const lower = dest.toLowerCase();
    if (lower.includes('kashmir') || lower.includes('himachal')) return '🏔️';
    if (lower.includes('goa') || lower.includes('kerala')) return '🏖️';
    if (lower.includes('rajasthan') || lower.includes('delhi')) return '🏛️';
    if (lower.includes('uttarakhand') || lower.includes('nepal')) return '⛰️';
    if (lower.includes('mumbai') || lower.includes('bangalore')) return '🏙️';
    return '🌍';
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDurationParts = (dur: string) => {
    const match = dur.match(/(\d+).*?(\d+)/);
    if (match) {
      return { nights: match[1], days: match[2] };
    }
    return { nights: '6', days: '7' };
  };

  const { nights, days } = getDurationParts(duration);

  return (
    <div className="group relative bg-white rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 animate-fadeIn">
      {/* Image Section */}
      <div className="relative h-48 overflow-hidden">
        {!imageError && imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 flex items-center justify-center">
            <div className="text-center text-white">
              <Camera className="w-12 h-12 mx-auto mb-2 opacity-70" />
              <p className="text-sm font-medium">{destination}</p>
            </div>
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Action buttons */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className={`p-2 rounded-full backdrop-blur-sm border border-white/20 transition-all duration-200 ${
              isLiked 
                ? 'bg-red-500 text-white' 
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            aria-label={isLiked ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>
          <button
            className="p-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 text-white hover:bg-white/30 transition-all duration-200"
            aria-label="Share trip"
          >
            <Share className="w-4 h-4" />
          </button>
        </div>

        {/* Destination emoji badge */}
        <div className="absolute top-4 left-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm text-sm font-medium">
            {getDestinationEmoji(destination)} {destination}
          </span>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6">
        {/* Title and Rating */}
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 leading-tight">
            {name}
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-4 h-4 ${
                    i < Math.floor(rating) 
                      ? 'text-yellow-400 fill-current' 
                      : 'text-gray-300'
                  }`} 
                />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-700">{rating}</span>
            <span className="text-sm text-gray-500">({reviews} reviews)</span>
          </div>
        </div>

        {/* Trip Details */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-gray-600">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">
              {nights} Nights • {days} Days
            </span>
          </div>
          
          {hotels && (
            <div className="flex items-center gap-3 text-gray-600">
              <Users className="w-4 h-4 text-green-500" />
              <span className="text-sm">{hotels}</span>
            </div>
          )}
        </div>

        {/* Price and CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex flex-col">
            <span className="text-sm text-gray-500">Starting from</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900">
                {formatPrice(price)}
              </span>
              <span className="text-sm text-gray-500">per person</span>
            </div>
          </div>
          
          <button className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-2xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl">
            View Details
          </button>
        </div>

        {/* Popular badge (conditional) */}
        {reviews > 100 && (
          <div className="absolute -top-2 left-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-orange-400 to-red-500 text-white text-xs font-semibold shadow-lg">
              🔥 Popular
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
