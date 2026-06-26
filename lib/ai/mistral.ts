import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

const mistral = createOpenAICompatible({
  name: "mistral",
  baseURL: "https://api.mistral.ai/v1",
  apiKey: process.env.MISTRAL_API_KEY,
})

export const mistralModel = mistral.chatModel("mistral-large-latest")

export const mistralFastModel = mistral.chatModel("mistral-small-latest")
