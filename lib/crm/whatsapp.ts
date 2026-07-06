"use strict";

import axios from "axios";
import { z } from "zod";

// Schema for WhatsApp message
const WhatsAppMessageSchema = z.object({
  id: z.string().optional(),
  to: z.string(), // Phone number in international format
  from: z.string(), // Business phone number
  body: z.string(),
  templateName: z.string().optional(),
  templateParams: z.record(z.string(), z.string()).optional(),
  dealId: z.string().optional(),
  contactId: z.string().optional(),
  timestamp: z.date().optional(),
});

export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>;

// Schema for WhatsApp template
const WhatsAppTemplateSchema = z.object({
  name: z.string(),
  body: z.string(),
  params: z.array(z.string()).optional(),
});

export type WhatsAppTemplate = z.infer<typeof WhatsAppTemplateSchema>;

// Mock templates (replace with database or config)
const TEMPLATES: Record<string, WhatsAppTemplate> = {
  followUp: {
    name: "follow_up",
    body: "Hi {{name}}, just checking in on our last conversation about {{product}}. Let me know if you have any questions!",
    params: ["name", "product"],
  },
  proposal: {
    name: "proposal",
    body: "Hi {{name}}, I've sent over the proposal for {{deal}}. Let me know your thoughts!",
    params: ["name", "deal"],
  },
  reEngage: {
    name: "re_engage",
    body: "Hi {{name}}, it's been a while since we last spoke. Would you be open to a quick catch-up next week?",
    params: ["name"],
  },
};

/**
 * Sends a WhatsApp message via WhatsApp Business API.
 * @param message - WhatsAppMessage
 * @param apiKey - WhatsApp Business API key
 * @param apiUrl - WhatsApp Business API URL
 * @returns Promise with message ID
 */
export const sendWhatsAppMessage = async (
  message: WhatsAppMessage,
  apiKey: string,
  apiUrl: string,
): Promise<string> => {
  try {
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: message.to,
      type: "text",
      text: { body: message.body },
    };

    if (message.templateName) {
      const template = TEMPLATES[message.templateName];
      if (!template) throw new Error(`Template ${message.templateName} not found`);

      payload.type = "template";
      payload.template = {
        name: template.name,
        language: { code: "en_US" },
        components: [
          {
            type: "body",
            parameters: Object.entries(message.templateParams || {}).map(([key, value]) => ({
              type: "text",
              text: value,
            })),
          },
        ],
      };
    }

    const response = await axios.post(apiUrl, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    return response.data.messages[0].id;
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
    throw error;
  }
};

/**
 * Logs a WhatsApp conversation to a deal timeline.
 * @param message - WhatsAppMessage
 * @param dealId - Deal ID to log the message to
 */
export const logWhatsAppToDeal = (
  message: WhatsAppMessage,
  dealId: string,
): void => {
  // In a real implementation, this would save to a database
  console.log(`Logged WhatsApp message to deal ${dealId}:`, message.body);
};

/**
 * Retrieves WhatsApp templates.
 * @param name - Optional template name to filter
 * @returns Array of WhatsAppTemplate
 */
export const getWhatsAppTemplates = (name?: string): WhatsAppTemplate[] => {
  if (name) return [TEMPLATES[name]].filter(Boolean);
  return Object.values(TEMPLATES);
};

/**
 * Formats a WhatsApp message using a template.
 * @param templateName - Name of the template
 * @param params - Template parameters
 * @returns Formatted message body
 */
export const formatWhatsAppMessage = (
  templateName: string,
  params: Record<string, string>,
): string => {
  const template = TEMPLATES[templateName];
  if (!template) throw new Error(`Template ${templateName} not found`);

  let body = template.body;
  Object.entries(params).forEach(([key, value]) => {
    body = body.replace(`{{${key}}}`, value);
  });

  return body;
};