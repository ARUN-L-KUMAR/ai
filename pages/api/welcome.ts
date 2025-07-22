import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await openai.chat.completions.create({
      messages: [{
        role: 'system',
        content: `You are TripXplo AI's welcome message generator. Create a sophisticated, professional welcome that would impress travel industry executives.

� **EXECUTIVE-LEVEL REQUIREMENTS:**

**STRUCTURE (MANDATORY):**
1. **Premium Brand Opening**: Professional greeting with TripXplo AI branding
2. **Value Proposition**: Clear statement of our intelligent travel expertise  
3. **Core Capabilities**: Exactly 5 key services with premium icons
4. **Professional Engagement**: Sophisticated call-to-action

**FORMATTING STANDARDS:**
- Use premium emojis (✨ 🎯 💎 🌟 🚁 🏔️ etc.)
- ## for main headings with strategic emoji placement
- ### for service categories with matching icons
- **Bold** for key service names and important details
- Professional bullet formatting: • **Service:** Description
- Strategic spacing for executive-level visual appeal

**TONE REQUIREMENTS:**
- Sophisticated and authoritative
- Professional confidence without arrogance  
- Global travel expertise positioning
- Premium service quality emphasis
- Solution-focused and results-oriented

**CONTENT GUIDELINES:**
- Position as intelligent travel technology
- Emphasize comprehensive travel solutions
- Include global destination expertise
- Highlight personalized service capability
- Showcase end-to-end travel planning

**VISUAL PRESENTATION:**
- Executive-level formatting
- Strategic use of visual breaks
- Professional color psychology through emoji selection
- Scannable layout for busy executives
- Clear hierarchy of information

Create a welcome message that positions TripXplo AI as the premium choice for intelligent travel planning!`
      }],
      model: "gpt-4o",
      temperature: 0.6,
      max_tokens: 600
    });

    const welcomeMessage = response?.choices?.[0]?.message?.content ?? "✨ **Welcome to TripXplo AI** ✈️\n\n## 🎯 Your Elite Travel Intelligence Platform\n\nElevate your travel experience with our sophisticated AI-powered travel assistant. I specialize in creating extraordinary journeys tailored to your unique preferences.\n\n### 🌟 **Premium Travel Services:**\n\n• **🌍 Global Destination Intelligence** - Discover 500+ expertly curated destinations\n• **� Exclusive Package Access** - Premium travel experiences and hidden gems  \n• **🎯 AI-Powered Personalization** - Smart recommendations based on your preferences\n• **💰 Transparent Pricing Analytics** - Comprehensive cost analysis and comparisons\n• **🏨 End-to-End Solutions** - Hotels, transportation, activities, and experiences\n\n### 🚁 **Ready to Craft Your Perfect Journey?**\n\nShare your travel aspirations, and I'll transform them into a meticulously planned adventure that exceeds your expectations.\n\n**What extraordinary destination shall we explore together?** 🗺️\n\n*Example: \"Show me luxury packages for Switzerland\" or \"Find adventure trips in Himachal Pradesh\"*\n\n---\n*TripXplo AI - Where Intelligence Meets Adventure*";
    
    res.status(200).json({ message: welcomeMessage });
  } catch (error) {
    console.error('Welcome API error:', error);
    res.status(200).json({ message: "🌟 **Welcome to TripXplo AI!** ✈️\n\nI'm your intelligent travel companion, ready to help you plan amazing journeys!\n\n## Here's how I can help you:\n• 🌍 **Find travel packages** by destination\n• 💰 **Get detailed pricing** and booking info  \n• 🎯 **Browse packages** by interests (adventure, romantic, family)\n• 📍 **Explore popular** destinations worldwide\n• 🏨 **Find hotels,** activities, and transportation\n\n**What amazing destination would you like to explore today?** 🗺️" });
  }
}