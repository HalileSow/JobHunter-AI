import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
});

export async function chat(messages) {
  const response = await client.chat.completions.create({
    model: "moonshot-v1-8k",
    messages,
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}
