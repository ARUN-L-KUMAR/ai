import OpenAI from "openai";

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface TripIntent {
  intent: 'get_packages' | 'ask_general' | 'unknown';
  destination: string | null;
  duration: number | null;
  planType: string | null;
}


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Analyze user intent using GPT
async function analyzeUserIntent(messages: Message[]): Promise<TripIntent> {
  try {
    const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    const response = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert travel intent analyzer. Analyze the conversation history and extract structured information about the user's travel intent.

🎯 **YOUR TASK:**
Analyze the entire conversation and return a JSON object with the following structure:
{
  "intent": "get_packages" | "ask_general" | "unknown",
  "destination": string | null,
  "duration": number | null,
  "planType": string | null
}

🧠 **INTENT CLASSIFICATION:**
- "get_packages": User wants to find/book travel packages, trips, tours, holidays, or is asking about specific travel options
- "ask_general": User is asking general travel questions, advice, or information
- "unknown": Intent is unclear or unrelated to travel

📍 **EXTRACTION RULES:**
- destination: Extract city/place names (e.g., "Goa", "Kashmir", "Manali", "Dubai")
- duration: Extract number of days/nights (convert "4-day" to 4, "3 nights" to 3)
- planType: Extract trip type/purpose (e.g., "honeymoon", "family", "adventure", "romantic", "business")

🔍 **EXAMPLES:**
- "I want to go on a 4-day honeymoon" → {"intent": "get_packages", "destination": null, "duration": 4, "planType": "honeymoon"}
- "Show me packages for Manali" → {"intent": "get_packages", "destination": "Manali", "duration": null, "planType": null}
- "What's the weather like in Goa?" → {"intent": "ask_general", "destination": "Goa", "duration": null, "planType": null}
- "Maybe Manali" (in context of destination question) → {"intent": "get_packages", "destination": "Manali", "duration": null, "planType": null}

Return ONLY the JSON object, no additional text.`
        },
        {
          role: 'user',
          content: `Analyze this conversation:\n\n${conversationHistory}`
        }
      ],
      model: "gpt-4o",
      temperature: 0.1,
      max_tokens: 200
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { intent: 'unknown', destination: null, duration: null, planType: null };
    }

    try {
      const parsed = JSON.parse(content);
      return {
        intent: parsed.intent || 'unknown',
        destination: parsed.destination || null,
        duration: parsed.duration || null,
        planType: parsed.planType || null
      };
    } catch (parseError) {
      console.error('🔍 Intent parsing error:', parseError);
      return { intent: 'unknown', destination: null, duration: null, planType: null };
    }
  } catch (error) {
    console.error('🔍 Intent analysis error:', error);
    return { intent: 'unknown', destination: null, duration: null, planType: null };
  }
}


export async function processWithai(messages: Message[]): Promise<string> {
  console.log('🚀 Starting processWithai with GPT-powered intent analysis...');
  console.log('📝 Input messages:', messages.map(m => ({ role: m.role, content: m.content.substring(0, 100) })));
  
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage) {
    return "✨ **TripXplo AI** - Your Travel Companion\n\nHello! I'm here to help you discover amazing travel experiences.\n\n💫 Ask me about destinations, packages, or travel tips!\n\n*What adventure are you dreaming of?* 🌍";
  }

  // Use GPT to analyze user intent and extract structured information
  const intent = await analyzeUserIntent(messages);
  console.log('🎯 Analyzed intent:', intent);

  // Handle different intents
  switch (intent.intent) {
    case 'get_packages':
      return await handlePackageRequest(intent, messages);
    
    case 'ask_general':
      return await handleGeneralQuery(messages);
    
    default:
      return await handleGeneralQuery(messages);
  }
}

// Handle package requests with smart conversation flow
async function handlePackageRequest(intent: TripIntent, messages: Message[]): Promise<string> {
  const { destination, duration, planType } = intent;
  
  // Check what information we have and what we need
  const missingInfo = [];
  if (!destination) missingInfo.push('destination');
  if (!duration) missingInfo.push('duration');
  
  // If we have all required info, fetch packages
  if (missingInfo.length === 0) {
    console.log(`🎪 Fetching packages for: ${destination}, ${duration} days, ${planType || 'any'}`);
    
    try {
      // Build API URL for packages
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      
      let apiUrl = `${baseUrl}/api/packages?destination=${encodeURIComponent(destination!)}&duration=${duration!}`;
      if (planType) {
        apiUrl += `&plan=${encodeURIComponent(planType)}`;
      }
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const packages = await response.json();
      
      if (!packages || packages.length === 0) {
        return await generateNoPackagesResponse(destination, duration, planType);
      }
      
      return await formatPackagesResponse(packages, destination, duration, planType);
      
    } catch (error) {
      console.error('💥 Package fetch error:', error);
      return "🔄 **Service Temporarily Unavailable**\n\nOur travel system is briefly offline. Please try again in a moment!\n\n✨ *Great travel experiences are worth the wait* 🌟";
    }
  }
  
  // Generate natural follow-up questions for missing information
  return await generateFollowUpQuestion(intent, missingInfo, messages);
}

// Generate natural follow-up questions when information is missing
async function generateFollowUpQuestion(intent: TripIntent, missingInfo: string[], messages: Message[]): Promise<string> {
  try {
    const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    const response = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are TripXplo AI, a friendly travel assistant. Generate a natural follow-up question to gather missing travel information.

🎯 **CONTEXT:**
- User wants travel packages
- Current info: destination="${intent.destination}", duration=${intent.duration}, planType="${intent.planType}"
- Missing info: ${missingInfo.join(', ')}

🧠 **QUESTION GUIDELINES:**
- Ask for the FIRST missing piece of information only
- Use natural, conversational language
- Include relevant emojis
- Keep it friendly and engaging
- If asking for destination, suggest 2-3 popular options
- If asking for duration, suggest common trip lengths
- Reference what they've already mentioned to show you're listening

🎪 **EXAMPLES:**
- Missing destination: "Lovely! A 4-day honeymoon sounds perfect! 💕 Do you have a destination in mind? Maybe somewhere romantic like Manali, Goa, or Kashmir?"
- Missing duration: "Great choice! Manali is beautiful for a honeymoon! 🏔️ How many days are you planning for this romantic getaway?"
- Missing both: "I'd love to help you plan the perfect honeymoon! 💕 Where are you thinking of going, and how many days would you like?"

Generate ONLY the follow-up question, no additional text.`
        },
        {
          role: 'user',
          content: `Generate a follow-up question based on this conversation:\n\n${conversationHistory}`
        }
      ],
      model: "gpt-4o",
      temperature: 0.7,
      max_tokens: 200
    });

    return response.choices?.[0]?.message?.content?.trim() || 
      "I'd love to help you find the perfect trip! Could you tell me more about what you're looking for? 🌍";
      
  } catch (error) {
    console.error('🔍 Follow-up question generation error:', error);
    
    // Fallback questions based on missing info
    if (missingInfo.includes('destination')) {
      return "I'd love to help you find the perfect trip! 🌍 Where would you like to go?";
    } else if (missingInfo.includes('duration')) {
      return `Great choice! ${intent.destination} sounds amazing! 🎯 How many days are you planning for this trip?`;
    }
    
    return "I'd love to help you find the perfect trip! Could you tell me more about what you're looking for? 🌍";
  }
}

// Handle general travel queries
async function handleGeneralQuery(messages: Message[]): Promise<string> {
  try {
    console.log('🤖 Processing general travel query...');
    const response = await openai.chat.completions.create({
      messages: [{
        role: 'system',
        content: `You are TripXplo AI, a professional travel consultant and assistant.

🎯 **YOUR ROLE:**
- Friendly, knowledgeable travel expert
- Provide helpful travel information and guidance
- Answer questions about destinations, travel tips, and general travel advice
- If users ask about packages, guide them through our smart conversation flow
- Maintain a warm, professional tone with appropriate emojis

🧠 **RESPONSE GUIDELINES:**
- Keep responses concise and helpful (under 300 words)
- Use emojis to enhance readability
- Provide actionable travel advice
- If asked about specific packages/pricing, suggest they tell you their travel preferences
- For general travel questions, provide informative and engaging answers

🎪 **SPECIAL INSTRUCTIONS:**
- If users ask about "packages", "tours", "trips" - encourage them to share their travel preferences
- For destination questions, provide helpful information but suggest our package finder
- Always maintain the TripXplo brand voice - professional yet friendly
- End responses naturally without asking too many questions`
      }, ...messages],
      model: "gpt-4o",
      temperature: 0.6,
      max_tokens: 500
    });

    const messageContent = response.choices?.[0]?.message?.content ?? "";
    console.log('📤 AI Response:', messageContent);

    if (!messageContent) {
      return "✨ **TripXplo AI** - Your Travel Companion\n\nHello! I'm here to help you discover amazing travel experiences.\n\n💫 Ask me about destinations, packages, or travel tips!\n\n*What adventure are you dreaming of?* 🌍";
    }

    return messageContent;
  } catch (error) {
    console.error('💥 OpenAI error:', error);
    return "✨ **TripXplo AI** - Your Travel Companion\n\nHello! I'm here to help you discover amazing travel experiences.\n\n💫 Ask me about destinations, packages, or travel tips!\n\n*What adventure are you dreaming of?* 🌍";
  }
}

// Generate response when no packages are found
async function generateNoPackagesResponse(destination: string | null, duration: number | null, planType: string | null): Promise<string> {
  const planText = planType ? ` for ${planType} trips` : '';
  const durationText = duration ? `${duration}-day ` : '';
  const destinationText = destination || 'your chosen destination';
  return `😕 **No packages found**\n\nSorry, I couldn't find any ${durationText}packages${planText} for ${destinationText} right now.\n\n🔄 **Try:**\n• Different duration (3-7 days are popular)\n• Different destination\n• Remove specific trip type filter\n\n💡 *Our inventory updates regularly, so check back soon!*`;
}

// Format packages response using GPT
async function formatPackagesResponse(packages: any[], destination: string | null, duration: number | null, planType: string | null): Promise<string> {
  try {
    const packagesData = JSON.stringify({
      packages: packages.slice(0, 3).map(pkg => ({
        name: pkg.packageName,
        destination: pkg.destinationName || destination,
        days: pkg.noOfDays,
        nights: pkg.noOfNight,
        startFrom: pkg.startFrom,
        hotels: pkg.hotelCount || 0,
        activities: pkg.activityCount || 0,
        packageId: pkg.packageId
      })),
      searchCriteria: { destination, duration, planType }
    });

    const response = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are TripXplo AI - create beautiful, engaging package presentations.

🎯 **RESPONSE STYLE:**
- Keep responses concise and elegant (within 400 words)
- Use meaningful emojis to enhance readability
- Use natural, friendly tone with professional formatting
- Create excitement about the travel options

📝 **FORMAT PACKAGES AS:**

✨ **Found [X] perfect matches for your ${duration}-day ${planType || ''} trip to ${destination}!**

🌍 **[Package Name]**
📅 Duration: X Nights / Y Days
📍 Destination: Location Name
💸 Starting From: ₹XX,XXX per person
🎡 Highlights: Key attractions and activities
🔖 Package ID: PACKAGECODE

[Repeat for each package]

🎯 **RULES:**
- Show all provided packages (max 3)
- Use emojis for visual clarity
- Keep tone warm, friendly, and natural
- Include package IDs for booking reference
- End with a helpful call-to-action`
        },
        {
          role: 'user',
          content: `Format these travel packages beautifully: ${packagesData}`
        }
      ],
      model: "gpt-4o",
      temperature: 0.6,
      max_tokens: 600
    });

    return response.choices?.[0]?.message?.content ?? 
      `✨ Found ${packages.length} packages for your ${duration}-day trip to ${destination}!\n\n${packages.slice(0, 3).map(pkg => 
        `🌍 ${pkg.packageName}\n📅 ${pkg.noOfDays} Days / ${pkg.noOfNight} Nights\n💸 From ₹${pkg.startFrom}\n🔖 ID: ${pkg.packageId}`
      ).join('\n\n')}`;
      
  } catch (error) {
    console.error('🎨 Format error:', error);
    return `✨ Found ${packages.length} packages for your ${duration}-day trip to ${destination}!\n\n${packages.slice(0, 3).map(pkg => 
      `🌍 ${pkg.packageName}\n📅 ${pkg.noOfDays} Days / ${pkg.noOfNight} Nights\n💸 From ₹${pkg.startFrom}\n🔖 ID: ${pkg.packageId}`
    ).join('\n\n')}`;
  }
}
