import Together from "together-ai";
import { tools, executeTool } from './tools';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const together = new Together();

async function formatToolResult(toolResult: string): Promise<string> {
  try {
    const response = await together.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Format travel packages with emoji title, ## headers for categories, bold package names, bullet points as • **Label:** Value. Group similar packages under categories.'
        },
        {
          role: 'user',
          content: `Format this travel data: ${toolResult}`
        }
      ],
      model: "deepseek-ai/DeepSeek-V3",
      temperature: 0.3,
      max_tokens: 4000
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
    console.log('🤖 Calling Together AI...');
    const response = await together.chat.completions.create({
      messages: [{
        role: 'system',
        content: 'You are TripXplo AI. MUST respond with JSON tool call. For packages: {"tool_call": {"tool_name": "get_packages", "arguments": {"search": "location"}}}. For pricing: {"tool_call": {"tool_name": "get_package_pricing", "arguments": {"packageId": "ID", "startDate": "YYYY-MM-DD", "noAdult": 2, "noChild": 0, "noRoomCount": 1, "noExtraAdult": 0}}}. NO markdown, ONLY JSON.'
      }, ...messages],
      model: "deepseek-ai/DeepSeek-V3",
      temperature: 0.1,
      max_tokens: 500
    });

    const messageContent = response.choices?.[0]?.message?.content ?? "";
    console.log('📤 AI Response:', messageContent);

    if (!messageContent) {
      console.log('❌ Empty AI response');
      return "I'm TripXplo AI, your travel assistant!";
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
          return "I'm experiencing technical difficulties fetching data right now. Please try again in a moment.";
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
    console.error('💥 Together AI error:', error);
    return "I'm TripXplo AI, your travel assistant! I can help you find amazing travel packages.";
  }
}