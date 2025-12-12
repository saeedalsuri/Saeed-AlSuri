import { GoogleGenAI } from "@google/genai";
import { OptimizationFramework, PromptConfig, PromptMode } from "../types";

// We create the AI instance dynamically in functions to ensure we pick up the latest key if changed via aistudio helper
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Optimizes the prompt based on the selected mode.
 */
export const optimizePrompt = async (
  rawInput: string,
  config: PromptConfig
): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key not found");
  const ai = getAI();

  const isVideo = config.mode === PromptMode.Video;
  const isImage = config.mode === PromptMode.Image;
  const frameworkInstruction = getFrameworkInstruction(config.framework, isVideo || isImage);
  
  let roleDefinition = "You are a world-class Prompt Engineer and AI Optimization Specialist.";
  if (isVideo) {
    roleDefinition = "You are an expert Video AI Director and Prompt Engineer for models like Google Veo, Sora, and Runway Gen-3.";
  } else if (isImage) {
    roleDefinition = "You are an expert Art Director, Historian, and Generative Image Specialist for models like Gemini Image, Midjourney, and Flux.";
  }

  let modeInstruction = "TEXT/CHAT GENERATION";
  if (isVideo) modeInstruction = "VIDEO GENERATION";
  if (isImage) modeInstruction = "IMAGE GENERATION";

  let specificFocus = "Ensure clarity, specificity, and constraints are explicitly defined.";
  if (isVideo) {
    specificFocus = "Focus intensely on PHOTOREALISM. Use keywords like 'raw footage', 'shot on film', '4k', 'highly detailed', 'live action'. Avoid 'CGI', '3D render', 'synthetic' looks. Describe Lighting (e.g., cinematic, golden hour), Camera Angles, and Motion/Physics.";
  } else if (isImage) {
     specificFocus = "Focus on PHOTOREALISM and Composition. Use keywords like 'photograph', 'f/1.8', '8k', 'sharp focus', 'raw style'. IMPORTANT: Explicitly decouple the subject's Ethnicity from their Attire/Armor if they differ. Prevent generation bias.";
  }

  const systemInstruction = `
    ${roleDefinition}
    Your goal is to take a raw, likely vague, user idea and rewrite it into a highly effective, structured prompt.

    CURRENT MODE: ${modeInstruction}
    
    GUIDELINES:
    1. ${frameworkInstruction}
    2. Adopt a ${config.tone} tone for the output.
    3. ${specificFocus}
    4. ${config.includeVariables ? "Identify dynamic parts of the prompt and replace them with placeholders like [INSERT_TOPIC]." : "Do not use placeholders unless absolutely necessary."}
    5. ${config.negativeConstraint ? `CRITICAL CONSTRAINT - STRICTLY AVOID / NEGATIVE PROMPT: "${config.negativeConstraint}". Ensure the final prompt explicitly negates these elements or structures the description to exclude them entirely.` : ""}
    6. RETURN ONLY THE OPTIMIZED PROMPT. Do not include "Here is your prompt" or markdown code blocks wrapper. Just the raw text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: rawInput,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "Failed to generate optimized prompt.";
  } catch (error) {
    console.error("Optimization error:", error);
    throw error;
  }
};

/**
 * Tests the prompt.
 */
export const testGeneratedPrompt = async (prompt: string, mode: PromptMode, aspectRatio: string = "16:9"): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key not found");
  
  try {
    if (mode === PromptMode.Video) {
      // VEOS VIDEO GENERATION
      // We must check for paid key selection before using Veo
      if (window.aistudio && !await window.aistudio.hasSelectedApiKey()) {
         await window.aistudio.openSelectKey();
      }

      const freshAI = getAI();
      let operation = await freshAI.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: aspectRatio === "9:16" ? "9:16" : "16:9" // Limit to valid Veo options
        }
      });

      // Poll for completion
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await freshAI.operations.getVideosOperation({ operation: operation });
      }

      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!videoUri) throw new Error("No video URI returned.");
      
      return `${videoUri}&key=${process.env.API_KEY}`;

    } else if (mode === PromptMode.Image) {
      // IMAGE GENERATION
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }]
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      return "No image generated. The model might have returned text instead.";

    } else {
      // TEXT GENERATION
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text || "No response generated.";
    }
  } catch (error) {
    console.error("Test error:", error);
    throw error;
  }
};

/**
 * Analyzes a generated image for historical/visual accuracy.
 */
export const analyzeImage = async (imageBase64URL: string, originalPrompt: string): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key not found");
  const ai = getAI();
  
  // Extract base64 data and mime type from data URL
  // Format: data:[mimeType];base64,[data]
  const matches = imageBase64URL.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid image data format");
  }
  const mimeType = matches[1];
  const base64Data = matches[2];

  const analysisPrompt = `
    Act as an Art Historian and QA Specialist. 
    Analyze the attached image which was generated from the prompt: "${originalPrompt}".
    
    CRITIQUE FOCUS:
    1. Historical Accuracy: Check Armor, Architecture, and Objects. Are they from the correct era/region?
    2. Ethnicity vs. Setting: Does the character's ethnicity match the request? Is there accidental blending (e.g. Indian features in Egyptian setting)?
    3. Visual Anomalies: Are there "leaks" where styles mix inappropriately?
    
    Provide a concise, bulleted analysis. Be critical.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: analysisPrompt }
        ]
      }
    });
    return response.text || "Could not analyze image.";
  } catch (error) {
    console.error("Analysis error:", error);
    throw error;
  }
};

function getFrameworkInstruction(framework: OptimizationFramework, isVisual: boolean): string {
  if (isVisual && framework === OptimizationFramework.Visual) {
     return "Use the VISUAL framework: Detail Visuals, Illumination (lighting), Subject, Usage (context/action), Angles (camera/viewpoint), and Lenses (depth/style).";
  }

  switch (framework) {
    case OptimizationFramework.COSTAR:
      return "Use the CO-STAR framework: Define Context, Objective, Style, Tone, Audience, and Response format clearly.";
    case OptimizationFramework.CLEAR:
      return "Use the CLEAR framework: Be Concise, Logical, Explicit, Adaptive, and Reflective.";
    case OptimizationFramework.Visual:
       return "Use the VISUAL framework: Detail Visuals, Illumination, Subject, Usage, Angles, and Lenses."; 
    case OptimizationFramework.Historical:
      return "Use the HISTORICAL framework (Period, Authenticity, Wares, Ethnography, Setting): 1) Identify the target Era. 2) FACT-CHECK Wares: Ensure Armor, Weapons, and Clothing are historically accurate to the region/date, OR explicitly noted if they are cross-cultural imports (e.g. Western Plate in the East). 3) Ethnography: Describe physical ethnicity explicitly if it contradicts the typical setting to avoid AI stereotype bias. 4) Use precise historical nomenclature (e.g. 'Sallet' not 'Helmet').";
    default:
      return "Improve clarity, fix grammar, and add necessary context and constraints.";
  }
}