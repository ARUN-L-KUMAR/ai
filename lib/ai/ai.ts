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

export async function processWithai(messages: Message[]): Promise<string> {
  console.log('🚀 Starting processWithai...');
  console.log('📝 Input messages:', messages.map(m => ({ role: m.role, content: m.content.substring(0, 100) })));
  
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage) {
    return "✨ **TripXplo AI** - Your Travel Companion\n\nHello! I'm here to help you discover amazing travel experiences.\n\n💫 Ask me about destinations, packages, or travel tips!\n\n*What adventure are you dreaming of?* 🌍";
  }

  const userContent = lastUserMessage.content.toLowerCase();
  const state = extractConversationState(messages);
  
  console.log('🎯 Current conversation state:', state);

  // Step 1: User asks for packages - Start guided conversation
  if (state.step === 'initial' && isPackageRequest(userContent)) {
    return `✨ **I'd love to help you find the perfect trip!** 🌍

To get started, could you tell me where you'd like to go?

You can choose from these popular destinations or type your own:

🏖️ **1.** Goa
🏔️ **2.** Kashmir  
🌴 **3.** Bali
🏙️ **4.** Dubai
✍️ **Other** (type your destination)

*Just type the number or destination name!*`;
  }

  // Step 2: User selected destination - Ask for duration
  if (state.step === 'destination') {
    const destination = lastUserMessage.content;
    return `🎯 **Great choice!** ${destination.includes('1') ? 'Goa' : destination.includes('2') ? 'Kashmir' : destination.includes('3') ? 'Bali' : destination.includes('4') ? 'Dubai' : destination} sounds amazing!

How many days are you planning for this trip?

📅 **1.** 2-3 Days (Quick Getaway)
📅 **2.** 4-5 Days (Perfect Break) 
📅 **3.** 6-7 Days (Full Experience)
📅 **4.** 8+ Days (Extended Vacation)
✍️ **Other** (type your preferred duration)

*Choose a number or tell me your ideal trip length!*`;
  }

  // Step 3: User selected duration - Ask for package type
  if (state.step === 'duration') {
    const duration = lastUserMessage.content;
    return `⏰ **Perfect timing!** ${duration.includes('1') ? '2-3 days' : duration.includes('2') ? '4-5 days' : duration.includes('3') ? '6-7 days' : duration.includes('4') ? '8+ days' : duration} will be wonderful!

Now, what type of package experience are you looking for?

🥇 **Gold** - Premium comfort & experiences
🥈 **Silver** - Great value with quality amenities  
🏆 **Premium** - Luxury & exclusive experiences
✍️ **Custom** (tell me your preferences)

*Almost there! Just pick your preferred package type.*`;
  }

  // Step 4: User selected package type - Now fetch packages
  if (state.step === 'packageType') {
    const packageType = lastUserMessage.content;
    
    // Extract the collected information
    let destination = state.destination || '';
    let duration = state.duration || '';
    
    console.log(`🔍 Raw values - destination: "${destination}", duration: "${duration}"`);
    
    // Map user selections to actual values
    if (destination.includes('1') || destination.toLowerCase().includes('goa')) destination = 'Goa';
    else if (destination.includes('2') || destination.toLowerCase().includes('kashmir')) destination = 'Kashmir';
    else if (destination.includes('3') || destination.toLowerCase().includes('bali')) destination = 'Bali';
    else if (destination.includes('4') || destination.toLowerCase().includes('dubai')) destination = 'Dubai';
    
    let days = 5; // default to a common duration
    if (duration.includes('1')) days = 3;
    else if (duration.includes('2')) days = 5;
    else if (duration.includes('3')) days = 7;
    else if (duration.includes('4')) days = 10;
    else {
      const match = duration.match(/(\d+)/);
      if (match) days = parseInt(match[1]);
    }

    console.log(`🎪 Fetching packages for: ${destination}, ${days} days, ${packageType}`);
    
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
