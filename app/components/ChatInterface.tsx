'use client';

import { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import WelcomeIntro from './WelcomeIntro';
import { Bot, Sparkles, MapPin, Globe, Heart, RotateCcw, ArrowLeft } from 'lucide-react';
import TripCard from './TripCard';

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

  // Add new state for destination selection
  const [destinationOptions, setDestinationOptions] = useState<any[]>([]);
  const [showDestinationOptions, setShowDestinationOptions] = useState(false);
  const [destinationOffset, setDestinationOffset] = useState(0);
  const DESTINATIONS_PAGE_SIZE = 5;

  // Add new state for duration selection
  const [durationOptions, setDurationOptions] = useState<number[]>([]);
  const [showDurationOptions, setShowDurationOptions] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);

  // Add new state for plan selection
  const [planOptions, setPlanOptions] = useState<string[]>([]);
  const [showPlanOptions, setShowPlanOptions] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);

  // Add new state for package results
  const [packageResults, setPackageResults] = useState<any[]>([]);
  const [showPackageResults, setShowPackageResults] = useState(false);

  type ConversationStep = 'welcome' | 'destination' | 'duration' | 'plan' | 'results' | 'chatting';
  const [conversationStep, setConversationStep] = useState<ConversationStep>('welcome');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Load messages from localStorage on initial render
    const savedMessages = localStorage.getItem('chatMessages');
    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages).map((msg: Message) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
      setMessages(parsedMessages);
      setShowWelcome(false);
    }
  }, []);

  useEffect(() => {
    // Save messages to localStorage whenever they change
    if (messages.length > 0) {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    }
    scrollToBottom();
  }, [messages]);

  const handleQuickStart = (query: string) => {
    setShowWelcome(false);
    setConversationStep('chatting');
    handleSendMessage(query);
  };

  const handleStartOver = () => {
    setMessages([]);
    localStorage.removeItem('chatMessages');
    setIsLoading(false);
    setShowWelcome(true);
    setDestinationOptions([]);
    setShowDestinationOptions(false);
    setDurationOptions([]);
    setShowDurationOptions(false);
    setPlanOptions([]);
    setShowPlanOptions(false);
    setPackageResults([]);
    setShowPackageResults(false);
    setSelectedDestination(null);
    setSelectedDuration(null);
    setConversationStep('welcome');
  };

  const handleGoBack = () => {
    const lastUserMessageIndex = messages.map(m => m.role).lastIndexOf('user');
    if (lastUserMessageIndex === -1) return;

    const lastUserMessage = messages[lastUserMessageIndex];
    const previousMessages = messages.slice(0, lastUserMessageIndex);
    const lastAssistantMessage = previousMessages.filter(m => m.role === 'assistant').pop();
    
    setMessages(previousMessages);

    switch (conversationStep) {
      case 'duration':
        setShowDurationOptions(false);
        setShowDestinationOptions(true);
        setConversationStep('destination');
        break;
      case 'plan':
        setShowPlanOptions(false);
        setShowDurationOptions(true);
        setConversationStep('duration');
        break;
      case 'results':
        setShowPackageResults(false);
        setShowPlanOptions(true);
        setConversationStep('plan');
        break;
    }
  };

  // Fetch destinations when user asks for packages
  const fetchDestinations = async () => {
    setIsLoading(true);
    setConversationStep('destination');
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: "Of course! I can help with that. Where would you like to go?", timestamp: new Date() }
    ]);
    try {
      const res = await fetch('/api/destinations');
      if (res.ok) {
        const data = await res.json();
        setDestinationOptions(data.destinations || []);
        setShowDestinationOptions(true);
        setDestinationOffset(DESTINATIONS_PAGE_SIZE);
      } else {
        setDestinationOptions([]);
        setShowDestinationOptions(false);
      }
    } catch (err) {
      setDestinationOptions([]);
      setShowDestinationOptions(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch durations for a destination
  const fetchDurations = async (destination: string) => {
    setIsLoading(true);
    setConversationStep('duration');
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: `Great choice! ${destination} is amazing. How many days are you planning for the trip?`, timestamp: new Date() }
    ]);
    try {
      const res = await fetch(`/api/package-options?destination=${encodeURIComponent(destination)}`);
      if (res.ok) {
        const data = await res.json();
        setDurationOptions(data.durations || []);
        setShowDurationOptions(true);
      } else {
        setDurationOptions([]);
        setShowDurationOptions(false);
      }
    } catch (err) {
      setDurationOptions([]);
      setShowDurationOptions(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch plans for a destination and duration
  const fetchPlans = async (destination: string, duration: number) => {
    setIsLoading(true);
    setConversationStep('plan');
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: `Perfect, a ${duration}-day trip it is! What kind of plan are you interested in?`, timestamp: new Date() }
    ]);
    try {
      const res = await fetch(`/api/package-options?destination=${encodeURIComponent(destination)}&duration=${duration}`);
      if (res.ok) {
        const data = await res.json();
        let plans = data.plans || [];
        setPlanOptions(plans);
        setShowPlanOptions(true);
      } else {
        setPlanOptions([]);
        setShowPlanOptions(false);
      }
    } catch (err) {
      setPlanOptions([]);
      setShowPlanOptions(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch packages based on all selections
  const fetchFilteredPackages = async (destination: string, duration: number, plan: string) => {
    setIsLoading(true);
    setConversationStep('results');
    setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Searching for the best ${plan} packages in ${destination} for ${duration} days...`, timestamp: new Date() }
    ]);
    try {
      const res = await fetch(`/api/packages?destination=${encodeURIComponent(destination)}&duration=${duration}&plan=${encodeURIComponent(plan)}`);
      let allPackages = [];
      if (res.ok) {
        allPackages = await res.json();
        // Ensure price is a number
        allPackages = allPackages.map((pkg: any) => {
          let price = 0;
          if (typeof pkg.startFrom === 'string') {
            price = parseFloat(pkg.startFrom.replace(/[^0-9.-]+/g, '')) || 0;
          } else if (typeof pkg.startFrom === 'number') {
            price = pkg.startFrom;
          }
          return { ...pkg, startFrom: price };
        });
      }
      setPackageResults(allPackages);
      setShowPackageResults(true);
    } catch (err) {
      setPackageResults([]);
      setShowPackageResults(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Intercept package request and show destinations
  const handleSendMessage = async (content: string) => {
    if (showWelcome) {
      setShowWelcome(false);
      setConversationStep('chatting');
    }
    setShowPackageResults(false);

    // If user asks for packages, show destinations instead of sending to backend
   if (/(show|see|suggest|want|give|looking|plan|planning|explore|find|search|recommend).*(package|trip|travel|plan|option|itinerary|place|vacation)s?/i.test(content)) {
      const userMessage: Message = {
        role: 'user',
        content,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      await fetchDestinations();
      return;
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
        content: data.response || ' **Service Briefly Offline**\n\nPlease try again in a moment!\n\n✨ *Amazing trips are worth the wait* 🌟',
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

  // Update handleSelectDestination to fetch durations
  const handleSelectDestination = (destination: any) => {
    setShowDestinationOptions(false);
    setMessages(prev => [
      ...prev,
      { role: 'user', content: destination.destinationName, timestamp: new Date() }
    ]);
    setSelectedDestination(destination.destinationName);
    fetchDurations(destination.destinationName);
  };

  // Handle duration selection
  const handleSelectDuration = (duration: number) => {
    setShowDurationOptions(false);
    setMessages(prev => [
      ...prev,
      { role: 'user', content: `${duration} Days`, timestamp: new Date() }
    ]);
    setSelectedDuration(duration);
    if (selectedDestination) {
      fetchPlans(selectedDestination, duration);
    }
  };

  // Handle plan selection and fetch packages
  const handleSelectPlan = (plan: string) => {
    setShowPlanOptions(false);
    setMessages(prev => [
      ...prev,
      { role: 'user', content: plan, timestamp: new Date() }
    ]);
    if (selectedDestination && selectedDuration) {
      fetchFilteredPackages(selectedDestination, selectedDuration, plan);
    }
  };

  const handleViewDetails = async (packageId: string) => {
    setIsLoading(true);
    setMessages(prev => [
      ...prev,
      { role: 'user', content: `Tell me more about package ${packageId}`, timestamp: new Date() }
    ]);

    try {
      const res = await fetch(`/api/packages?id=${packageId}`);
      if (!res.ok) throw new Error('Failed to fetch package details');
      
      const data = await res.json();
      const pkg = data[0];

      const formattedDetails = `
🏝️ **${pkg.packageName}**  
📅 **Duration**: ${pkg.noOfNight} Nights / ${pkg.noOfDays} Days  
📍 **Destination**: ${pkg.destinationName}  
💸 **Starting From**: ₹${pkg.startFrom.toLocaleString('en-IN')} per person  
🎡 **Highlights**: ${pkg.planName}  
💖 **Perfect For**: ${pkg.perfectFor}  
🔖 **Package ID**: ${pkg.packageId}
      `;

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: formattedDetails, timestamp: new Date() }
      ]);

    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I couldn\'t fetch the details for that package.', timestamp: new Date() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle show more destinations
  const handleShowMoreDestinations = () => {
    setDestinationOffset(prev => prev + DESTINATIONS_PAGE_SIZE);
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

            {/* Stats & Actions */}
            <div className="hidden md:flex items-center gap-6 text-sm">
              <button 
                onClick={handleStartOver}
                className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="font-medium">Start Over</span>
              </button>
              {['duration', 'plan', 'results'].includes(conversationStep) && (
                <button 
                  onClick={handleGoBack}
                  className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="font-medium">Go Back</span>
                </button>
              )}
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
              {/* Destination selection UI */}
              {showDestinationOptions && destinationOptions.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-indigo-100 mt-4">
                  <h3 className="text-lg font-semibold mb-4">Please choose the location you’d like to visit:</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    {destinationOptions.slice(0, destinationOffset).map((dest, idx) => (
                      <button
                        key={dest.destinationName + idx}
                        className="px-4 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl font-medium text-gray-800 hover:bg-indigo-200 transition"
                        onClick={() => handleSelectDestination(dest)}
                      >
                        {dest.destinationName}
                      </button>
                    ))}
                  </div>
                  {destinationOffset < destinationOptions.length && (
                    <button
                      className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition"
                      onClick={handleShowMoreDestinations}
                    >
                      Show more
                    </button>
                  )}
                </div>
              )}
              {/* Duration selection UI */}
              {showDurationOptions && durationOptions.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-indigo-100 mt-4">
                  <h3 className="text-lg font-semibold mb-4">How many days are you planning for this trip?</h3>
                  <div className="flex flex-wrap gap-4 mb-4">
                    {durationOptions.map((duration, idx) => (
                      <button
                        key={duration + '-' + idx}
                        className="px-4 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl font-medium text-gray-800 hover:bg-indigo-200 transition"
                        onClick={() => handleSelectDuration(duration)}
                      >
                        {duration} Days
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Plan selection UI */}
              {showPlanOptions && planOptions.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-indigo-100 mt-4">
                  <h3 className="text-lg font-semibold mb-4">What plan are you interested in?</h3>
                  <div className="flex flex-wrap gap-4 mb-4">
                    {planOptions.map((plan, idx) => (
                      <button
                        key={plan + '-' + idx}
                        className="px-4 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl font-medium text-gray-800 hover:bg-indigo-200 transition"
                        onClick={() => handleSelectPlan(plan)}
                      >
                        {plan}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Package results UI */}
              {showPackageResults && (
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-indigo-100 mt-4">
                  <h3 className="text-lg font-semibold mb-4">Available Packages</h3>
                  {packageResults.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {packageResults.map((pkg, idx) => (
                        <TripCard
                          key={pkg._id || idx}
                          name={pkg.packageName}
                          destination={pkg.destinationName || pkg.startFrom}
                          nights={pkg.noOfNight}
                          days={pkg.noOfDays}
                          price={pkg.startFrom}
                          hotels={pkg.hotels}
                          imageUrl={`https://images.unsplash.com/800x600/?travel,${(pkg.destinationName || pkg.startFrom || '').toLowerCase().replace(/\s+/g, ',')}`}
                          onViewDetails={() => handleViewDetails(pkg.packageId)}
                          packageId={pkg.packageId}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-600">No packages found for your selection.</div>
                  )}
                </div>
              )}
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
