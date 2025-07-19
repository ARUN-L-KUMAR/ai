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
        content: 'Generate a complete welcome message for TripXplo AI. Include: 1) Friendly greeting with emojis 2) "Here are some ways I can help:" 3) Exactly 5 bullet points: packages by destination, pricing details, browse by interests, explore destinations, find hotels/activities. Keep it concise and complete. End with "What would you like to explore today?"'
      }],
      model: "gpt-4o",
      temperature: 0.9,
      max_tokens: 400
    });

    const welcomeMessage = response?.choices?.[0]?.message?.content ?? "Hello! I'm TripXplo AI, your travel assistant. I can help you find amazing travel packages and plan your trips. What kind of adventure are you looking for?";
    
    res.status(200).json({ message: welcomeMessage });
  } catch (error) {
    console.error('Welcome API error:', error);
    res.status(200).json({ message: "Hello! I'm TripXplo AI, your travel assistant. I can help you find amazing travel packages and plan your trips. What kind of adventure are you looking for?" });
  }
}