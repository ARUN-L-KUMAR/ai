import OpenAI from "openai";
import { tools, executeTool } from './tools';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function formatToolResult(toolResult: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are TripXplo AI - create neat, short, and beautiful responses.

🎯 **RESPONSE STYLE:**
- Keep responses concise and elegant (max 300 words)
- Use minimal but meaningful emojis
- Clean, professional formatting
- Natural, friendly tone

📝 **FORMAT PACKAGES AS:**

✨ Found [X] perfect matches for you!

🏔️ **Package Name** • Duration • ₹Price
Key highlight in one line
🔖 ID: PACKAGECODE

[Repeat for 2-3 top packages max]

💫 **Quick question:** What matters most - budget, luxury, or adventure?

🎯 **RULES:**
- Maximum 3 packages shown
- One-line highlights only  
- Single follow-up question
- Warm but brief tone
- Clean visual structure`
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
  
  try {
    console.log('🤖 Calling OpenAI...');
    const response = await openai.chat.completions.create({
      messages: [{
        role: 'system',
        content: `You are TripXplo AI, a sophisticated and professional travel intelligence system. You represent a premium travel company and must maintain the highest standards of professionalism and expertise.

🎯 **YOUR CORE IDENTITY:**
- Elite travel consultant with global destination expertise
- Professional, knowledgeable, and solution-focused
- Proactive in understanding customer needs and preferences
- Authority on Indian and international travel experiences
- Committed to delivering exceptional travel planning services

🧠 **INTELLIGENCE FRAMEWORK:**
Analyze user queries with precision and respond ONLY with properly formatted JSON tool calls:

**For Travel Package Inquiries:**
{"tool_call": {"tool_name": "get_packages", "arguments": {"search": "destination_name", "days": number}}}

**For Detailed Package Information:**
{"tool_call": {"tool_name": "get_package_details", "arguments": {"packageId": "EXACT_PACKAGE_ID"}}}

**For Pricing and Booking Details:**
{"tool_call": {"tool_name": "get_package_pricing", "arguments": {"packageId": "EXACT_ID", "startDate": "YYYY-MM-DD", "noAdult": 2, "noChild": 0, "noRoomCount": 1, "noExtraAdult": 0}}}

**For Destination Research:**
{"tool_call": {"tool_name": "search_destinations", "arguments": {"search": "location_name"}}}

**For Travel Interest Categories:**
{"tool_call": {"tool_name": "get_interests", "arguments": {}}}

**For Hotel Options:**
{"tool_call": {"tool_name": "get_available_hotels", "arguments": {"packageId": "EXACT_ID"}}}

**For Transportation:**
{"tool_call": {"tool_name": "get_available_vehicles", "arguments": {"packageId": "EXACT_ID"}}}

**For Activities & Experiences:**
{"tool_call": {"tool_name": "get_available_activities", "arguments": {"packageId": "EXACT_ID"}}}

🎪 **QUERY INTELLIGENCE MAPPING:**
- "packages", "trips", "tours", "holidays" → get_packages
- "price", "cost", "booking", "rates" → get_package_pricing  
- "destinations", "places", "where to go" → search_destinations
- "details", "itinerary", "more info" → get_package_details
- "hotels", "accommodation" → get_available_hotels
- "transport", "vehicles", "cabs" → get_available_vehicles
- "activities", "things to do", "experiences" → get_available_activities
- "interests", "categories", "types" → get_interests

🎯 **RESPONSE PROTOCOL:**
- ALWAYS respond with valid JSON tool call - NO exceptions
- NO conversational text outside JSON structure
- Extract specific details from user queries intelligently
- Use reasonable defaults for missing parameters
- Maintain professional precision in tool selection

⚡ **EXECUTION STANDARDS:**
- Zero tolerance for formatting errors
- Immediate tool selection and execution
- Professional-grade data interpretation
- Customer-centric solution orientation`
      }, ...messages],
      model: "gpt-4o",
      temperature: 0.1,
      max_tokens: 500
    });

    const messageContent = response.choices?.[0]?.message?.content ?? "";
    console.log('📤 AI Response:', messageContent);

    if (!messageContent) {
      console.log('❌ Empty AI response');
      return "✨ **TripXplo AI** - Your Travel Companion\n\nHello! I'm here to help you discover amazing travel experiences.\n\n💫 Ask me about destinations, packages, or travel tips!\n\n*What adventure are you dreaming of?* 🌍";
    }

    // Try parsing tool call from AI's JSON response
    try {
      console.log('🔍 Attempting to parse tool call...');
      let cleanContent = messageContent.replace(/```json\s*|```\s*/g, '').trim();
      console.log('🧹 Cleaned content:', cleanContent);
      
      const parsed = JSON.parse(cleanContent);
      console.log('✅ Parsed JSON:', parsed);
      
      if (parsed?.tool_call?.tool_name && parsed?.tool_call?.arguments) {
        const toolName = parsed.tool_call.tool_name;
        const toolArgs = parsed.tool_call.arguments;
        
        console.log(`🔧 Executing tool: ${toolName}`);
        console.log('📋 Tool arguments:', toolArgs);
        
        let toolResult = await executeTool(toolName, toolArgs);
        console.log('🎯 Tool result length:', toolResult.length);
        console.log('📊 Tool result preview:', toolResult.substring(0, 200));
        
        // Retry logic for failed tool executions
        const maxRetries = 3;
        let retryCount = 0;
        
        while (toolResult.includes('Sorry, I couldn\'t fetch') && retryCount < maxRetries) {
          retryCount++;
          console.log(`🔄 Tool failed, retrying... (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
          
          toolResult = await executeTool(toolName, toolArgs);
          console.log(`🎯 Retry ${retryCount} result length:`, toolResult.length);
          console.log(`📊 Retry ${retryCount} result preview:`, toolResult.substring(0, 200));
        }
        
        if (toolResult.includes('Sorry, I couldn\'t fetch')) {
          console.log('❌ All tool retries failed');
          return "🔄 **Service Temporarily Unavailable**\n\nOur travel system is briefly offline. Please try again in a moment!\n\n✨ *Great travel experiences are worth the wait* 🌟";
        }
        
        console.log('🎨 Formatting result...');
        const formattedResult = await formatToolResult(toolResult);
        console.log('✨ Formatted result length:', formattedResult.length);
        
        return formattedResult;
      } else {
        console.log('❌ Invalid tool call structure');
        console.log('🔍 Parsed structure:', Object.keys(parsed));
      }
    } catch (parseError) {
      console.log('❌ JSON parse error:', parseError);
      console.log('📝 Raw content that failed to parse:', messageContent);
    }

    console.log('🔄 Returning AI message as-is');
    return messageContent;
  } catch (error) {
    console.error('💥 OpenAI error:', error);
    return "✨ **TripXplo AI** - Your Travel Companion\n\nHello! I'm here to help you discover amazing travel experiences.\n\n💫 Ask me about destinations, packages, or travel tips!\n\n*What adventure are you dreaming of?* 🌍";
  }
}
