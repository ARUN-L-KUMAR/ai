import OpenAI from "openai";
import { tools, executeTool } from './tools';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ConversationState {
  step: 'initial' | 'destination' | 'duration' | 'packageType' | 'complete';
  destination?: string;
  duration?: string;
  packageType?: string;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Extract conversation state from message history
function extractConversationState(messages: Message[]): ConversationState {
  const state: ConversationState = { step: 'initial' };
  
  // Find the last assistant question to determine current step
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    
    if (message.role === 'assistant') {
      // If last assistant message asked for package type
      if (message.content.includes('what type of package experience')) {
        state.step = 'packageType';
        
        // Find destination and duration from the conversation
        const allMessages = messages.slice(0, i); // Messages before this question
        const userMessages = allMessages.filter(m => m.role === 'user');
        
        // Look for destination - should be the user response after "where you'd like to go"
        for (let j = 0; j < allMessages.length - 1; j++) {
          if (allMessages[j].role === 'assistant' && allMessages[j].content.includes('where you\'d like to go')) {
            if (j + 1 < allMessages.length && allMessages[j + 1].role === 'user') {
              state.destination = allMessages[j + 1].content;
              break;
            }
          }
        }
        
        // Look for duration - should be the user response after "How many days"
        for (let j = 0; j < allMessages.length - 1; j++) {
          if (allMessages[j].role === 'assistant' && allMessages[j].content.includes('How many days')) {
            if (j + 1 < allMessages.length && allMessages[j + 1].role === 'user') {
              state.duration = allMessages[j + 1].content;
              break;
            }
          }
        }
        break;
      }
      // If last assistant message asked for duration
      else if (message.content.includes('How many days')) {
        state.step = 'duration';
        
        // Find destination from the conversation
        const allMessages = messages.slice(0, i);
        for (let j = 0; j < allMessages.length - 1; j++) {
          if (allMessages[j].role === 'assistant' && allMessages[j].content.includes('where you\'d like to go')) {
            if (j + 1 < allMessages.length && allMessages[j + 1].role === 'user') {
              state.destination = allMessages[j + 1].content;
              break;
            }
          }
        }
        break;
      }
      // If last assistant message asked for destination
      else if (message.content.includes('where you\'d like to go')) {
        state.step = 'destination';
        break;
      }
    }
  }
  
  console.log('🔍 Extracted state:', state);
  return state;
}

// Check if user is asking for packages
function isPackageRequest(content: string): boolean {
  const packageKeywords = [
    'package', 'packages', 'trips', 'tours', 'holidays', 'show me packages',
    'what packages', 'tour list', 'available packages', 'travel packages',
    'vacation packages', 'holiday packages', 'show me the package', 'show package',
    'show the option', 'show options', 'show me options', 'travel options',
    'trip options', 'holiday options', 'vacation options', 'tour options'
  ];
  
  // Also check for common patterns
  const lowerContent = content.toLowerCase();
  
  // Direct package requests
  if (packageKeywords.some(keyword => lowerContent.includes(keyword))) {
    return true;
  }
  
  // Pattern matching for "show me/show the + any travel related word"
  const showPatterns = [
    /show\s+(me\s+)?(the\s+)?(package|trip|tour|holiday|vacation|option)/i,
    /what\s+(package|trip|tour|holiday|vacation|option)/i,
    /available\s+(package|trip|tour|holiday|vacation|option)/i
  ];
  
  return showPatterns.some(pattern => pattern.test(content));
}

async function formatToolResult(toolResult: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are TripXplo AI - create neat, short, and beautiful responses.

🎯 **RESPONSE STYLE:**
- Keep responses concise and elegant (within 300 words)
- Use meaningful emojis to enhance readability
- Use natural, friendly tone with professional formatting
- Avoid clutter — clean layout with proper line breaks

📝 **FORMAT PACKAGES AS:**

✨ Found [X] perfect matches for you!

🌍 [Package Name]
📅 Duration: X Nights / Y Days
📍 Destination: Location Name
💸 Starting From: ₹XX,XXX per person
🎡 Highlights: Key attractions and activities
💖 Perfect For: Families, couples, adventure seekers
🔖 Package ID: PACKAGECODE

[Repeat for up to 3 top packages]

🎯 **RULES:**
- Max 3 packages per response
- One-line descriptions under Highlights
- Use emojis for visual clarity
- Keep tone warm, friendly, and natural — like a helpful travel planner`
        },
        {
          role: 'user',
          content: `Make this travel data neat, short and beautiful: ${toolResult}`
        }
      ],
      model: "gpt-4o",
      temperature: 0.6,
      max_tokens: 500
    });

    return response.choices?.[0]?.message?.content ?? toolResult;
  } catch (error) {
    console.error('🎨 Format error:', error);
    return toolResult;
  }
}

// Helper to extract options from previous assistant message
function extractOptionsFromMessage(message: string, regex: RegExp): string[] {
  const options: string[] = [];
  let match;
  while ((match = regex.exec(message)) !== null) {
    options.push(match[1]);
  }
  return options;
}

// Helper to extract package type/interest from user input
function extractPackageTypeFromContent(content: string): string | undefined {
  const lower = content.toLowerCase();
  if (lower.includes('family')) return 'family';
  if (lower.includes('adventure')) return 'adventure';
  if (lower.includes('romantic')) return 'romantic';
  if (lower.includes('beach')) return 'beach';
  if (lower.includes('vacation')) return 'family';
  if (lower.includes('getaway')) return 'beach';
  if (lower.includes('honeymoon')) return 'romantic';
  // Add more mappings as needed
  return undefined;
}

export async function processWithai(messages: Message[]): Promise<string> {
  console.log('🚀 Starting processWithai...');
  console.log('📝 Input messages:', messages.map(m => ({ role: m.role, content: m.content.substring(0, 100) })));
  
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage) {
    return "✨ **TripXplo AI** - Your Travel Companion\n\nHello! I'm here to help you discover amazing travel experiences.\n\n💫 Ask me about destinations, packages, or travel tips!\n\n*What adventure are you dreaming of?* 🌍";
  }

  const userContent = lastUserMessage.content.toLowerCase();
  const state = extractConversationState(messages);

  // Extract package type/interest from initial user request if present
  let initialPackageType = extractPackageTypeFromContent(userContent);
  // If not found in initial, check previous state
  if (!initialPackageType && state.packageType) initialPackageType = state.packageType;

  console.log('🎯 Current conversation state:', state);

  // Step 1: User asks for packages - Start guided conversation
  if (state.step === 'initial' && isPackageRequest(userContent)) {
    return `✨ **I'd love to help you find the perfect trip!** 🌍\n\nTo get started, could you tell me where you'd like to go?\n\nYou can choose from these popular destinations or type your own:\n\n🏖️ **1.** Goa\n🏔️ **2.** Kashmir  \n🌴 **3.** Bali\n🏙️ **4.** Dubai\n✍️ **Other** (type your destination)\n\n*Just type the number or destination name!*`;
  }

  // Step 2: User selected destination - Ask for duration
  if (state.step === 'destination') {
    let destination = lastUserMessage.content.trim();
    // Map numeric input to destination name
    if (destination === '1') destination = 'Goa';
    else if (destination === '2') destination = 'Kashmir';
    else if (destination === '3') destination = 'Bali';
    else if (destination === '4') destination = 'Dubai';

    // If the user changed the destination, reset the package type filter
    let prevDestination = state.destination ? state.destination.trim().toLowerCase() : '';
    let currDestination = destination.trim().toLowerCase();
    let effectivePackageType = initialPackageType;
    if (prevDestination && prevDestination !== currDestination) {
      effectivePackageType = undefined;
    }

    let dynamicDurations = [];
    let dynamicTypes = [];
    // Build absolute URL for server-side fetch
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    try {
      // Call the new API endpoint to get available durations and package types
      let url = `${baseUrl}/api/package-options?destination=${encodeURIComponent(destination)}`;
      if (effectivePackageType) {
        url += `&packageType=${encodeURIComponent(effectivePackageType)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        dynamicDurations = data.durations || [];
        dynamicTypes = data.packageTypes || [];
      }
    } catch (err) {
      console.error('Failed to fetch dynamic options:', err);
    }

    if (dynamicDurations.length > 0) {
      // Build dynamic duration options
      const durationOptions = dynamicDurations.map((d: string | number, i: number) => `📅 **${i + 1}.** ${d} Days`).join('\n');
      return `🎯 **Great choice!** ${destination} sounds amazing!\n\nHow many days are you planning for this trip?\n\n${durationOptions}\n✍️ **Other** (type your preferred duration)\n\n*Choose a number or tell me your ideal trip length!*`;
    } else {
      // No durations for this destination and type
      let typeMsg = effectivePackageType ? ` for "${effectivePackageType}" packages` : '';
      return `😕 Sorry, there are no available durations${typeMsg} in ${destination}.\n\nTry another type or destination!`;
    }
    // fallback to static options if dynamic not available (should not reach here)
  }

  // Step 3: User selected duration - Ask for package type
  if (state.step === 'duration') {
    const durationInput = lastUserMessage.content.trim();
    let destination = state.destination || '';
    // Map numeric input to destination name
    if (destination === '1') destination = 'Goa';
    else if (destination === '2') destination = 'Kashmir';
    else if (destination === '3') destination = 'Bali';
    else if (destination === '4') destination = 'Dubai';

    // Extract dynamic durations from previous assistant message
    const prevAssistantMsg = messages.filter(m => m.role === 'assistant').pop()?.content || '';
    // Match lines like: 📅 **1.** 4 Days
    const durationRegex = /\*\*\d+\.\*\* ([\d]+) Days/g;
    const dynamicDurations = extractOptionsFromMessage(prevAssistantMsg, durationRegex);

    let selectedDuration = durationInput;
    const userIndex = parseInt(durationInput, 10) - 1;
    if (!isNaN(userIndex) && dynamicDurations[userIndex] !== undefined) {
      selectedDuration = dynamicDurations[userIndex];
    }

    let dynamicTypes: (string | number)[] = [];
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    try {
      // Call the new API endpoint to get available package types for the destination and type
      let url = `${baseUrl}/api/package-options?destination=${encodeURIComponent(destination)}`;
      if (initialPackageType) {
        url += `&packageType=${encodeURIComponent(initialPackageType)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        dynamicTypes = data.packageTypes || [];
      }
    } catch (err) {
      console.error('Failed to fetch dynamic package types:', err);
    }

    if (dynamicTypes.length > 0) {
      // Build dynamic package type options
      const typeOptions = dynamicTypes.map((t: string | number, i: number) => `🏷️ **${i + 1}.** ${t}`).join('\n');
      return `⏰ **Perfect timing!** ${selectedDuration} days will be wonderful!\n\nNow, what type of package experience are you looking for?\n\n${typeOptions}\n✍️ **Custom** (tell me your preferences)\n\n*Almost there! Just pick your preferred package type.*`;
    }
    // fallback to static options if dynamic not available
    return `⏰ **Perfect timing!** ${selectedDuration} days will be wonderful!\n\nNow, what type of package experience are you looking for?\n\n🥇 **Gold** - Premium comfort & experiences\n🥈 **Silver** - Great value with quality amenities  \n🏆 **Premium** - Luxury & exclusive experiences\n✍️ **Custom** (tell me your preferences)\n\n*Almost there! Just pick your preferred package type.*`;
  }

  // Step 4: User selected package type - Now fetch packages
  if (state.step === 'packageType') {
    const packageTypeInput = lastUserMessage.content.trim();
    let destination = state.destination || '';
    let duration = state.duration || '';
    // Map numeric input to destination name
    if (destination === '1') destination = 'Goa';
    else if (destination === '2') destination = 'Kashmir';
    else if (destination === '3') destination = 'Bali';
    else if (destination === '4') destination = 'Dubai';

    // Extract dynamic durations from previous assistant message (for correct days value)
    const prevAssistantMsg = messages.filter(m => m.role === 'assistant').pop()?.content || '';
    const durationRegex = /\*\*\d+\.\*\* ([\d]+) Days/g;
    const dynamicDurations = extractOptionsFromMessage(prevAssistantMsg, durationRegex);
    let days = duration;
    const durationIndex = parseInt(duration, 10) - 1;
    if (!isNaN(durationIndex) && dynamicDurations[durationIndex] !== undefined) {
      days = dynamicDurations[durationIndex];
    } else {
      // fallback: try to parse as a number directly
      const match = duration.match(/(\d+)/);
      if (match) days = match[1];
    }

    // Extract dynamic package types from previous assistant message
    const typeRegex = /🏷️ \*\*\d+\.\*\* ([^\n]+)/g;
    const dynamicTypes = extractOptionsFromMessage(prevAssistantMsg, typeRegex);
    let selectedType = packageTypeInput;
    const typeIndex = parseInt(packageTypeInput, 10) - 1;
    if (!isNaN(typeIndex) && dynamicTypes[typeIndex] !== undefined) {
      selectedType = dynamicTypes[typeIndex];
    }

    console.log(`🔍 Raw values - destination: "${destination}", duration: "${days}"`);
    console.log(`🎪 Fetching packages for: ${destination}, ${days} days, ${selectedType}`);

    try {
      // Try to get packages - first with exact search, then fallback to general search
      let toolResult = await executeTool('get_packages', {
        search: destination,
        days: days
      });
      
      // If no results, try without days filter
      if (toolResult.includes('No packages') || toolResult.includes('Sorry, I couldn\'t fetch')) {
        console.log('🔄 Retrying without days filter...');
        toolResult = await executeTool('get_packages', {
          search: destination,
          days: 0 // 0 might mean "any duration"
        });
      }
      
      // If still no results, try with just general search
      if (toolResult.includes('No packages') || toolResult.includes('Sorry, I couldn\'t fetch')) {
        console.log('🔄 Retrying with general search...');
        toolResult = await executeTool('get_packages', {
          search: '',
          days: days
        });
      }
      
      if (toolResult.includes('Sorry, I couldn\'t fetch')) {
        return "🔄 **Service Temporarily Unavailable**\n\nOur travel system is briefly offline. Please try again in a moment!\n\n✨ *Great travel experiences are worth the wait* 🌟";
      }
      
      const formattedResult = await formatToolResult(toolResult);
      return formattedResult;
      
    } catch (error) {
      console.error('💥 Package fetch error:', error);
      return "🔄 **Service Temporarily Unavailable**\n\nOur travel system is briefly offline. Please try again in a moment!\n\n✨ *Great travel experiences are worth the wait* 🌟";
    }
  }

  // Handle other queries (non-package requests)
  try {
    console.log('🤖 Processing non-package query...');
    const response = await openai.chat.completions.create({
      messages: [{
        role: 'system',
        content: `You are TripXplo AI, a professional travel consultant and assistant.

🎯 **YOUR ROLE:**
- Friendly, knowledgeable travel expert
- Provide helpful travel information and guidance
- Answer questions about destinations, travel tips, and general travel advice
- If users ask about packages, guide them through our step-by-step process
- Maintain a warm, professional tone with appropriate emojis

🧠 **RESPONSE GUIDELINES:**
- Keep responses concise and helpful
- Use emojis to enhance readability
- Provide actionable travel advice
- If asked about specific packages/pricing, guide users to start our package selection process
- For general travel questions, provide informative and engaging answers

🎪 **SPECIAL INSTRUCTIONS:**
- If users ask about "packages", "tours", "trips" - guide them to start our selection process
- For destination questions, provide helpful information but suggest our package finder
- Keep responses under 300 words
- Always maintain the TripXplo brand voice - professional yet friendly`
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
