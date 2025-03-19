import { genkit, z, Genkit } from "genkit";
import { openAI, gpt4oMini } from "genkitx-openai";
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { getJson } from 'serpapi';
import dotenv from 'dotenv';
import { ResearchTools } from './ResearchTools';
import path from 'path';
import fs from 'fs';
import type { ToolAction } from "genkit";

// Load environment variables
dotenv.config();

type Thought = {
  type: 'thought' | 'action' | 'observation';
  content: string;
  timestamp: number;
};

// Add type definitions at the top of the file
type ToolRequest = {
  name: string;
  input: any;
};

interface ResearchReport {
  topic: string;
  searchResults: any;
  sections: Array<{
    title: string;
    content?: string;
    subsections?: Array<{
      title: string;
      content: string;
    }>;
  }>;
  toolsUsed?: Array<{
    name: string;
    purpose: string;
  }>;
}

interface ToolInput {
  query?: string;
  url?: string;
  content?: string;
  numResults?: number;
  sources?: Array<{ name: string; content: string }>;
  data?: any;
  options?: Record<string, any>;
}

/**
 * DeepSearch - A TypeScript class for deep research using GenKit, Playwright, and SerpAPI.
 * With autonomous tool selection capabilities.
 */
export class DeepSearch {
  private ai: Genkit;
  private browser: any;
  private context: any;
  private researchTools: ResearchTools;
  private researchState: {
    status: 'idle' | 'thinking' | 'acting' | 'observing' | 'reporting';
    currentTopic: string;
    thoughts: Thought[];
    collectedInfo: Map<string, any>;
    finalReport: string;
    currentStep: string;
    stepDetails: string[];
  };
  private apiKey: string;
  private tools: ToolAction<any, any>[] = [];
  private reportsDir: string;
  private initBrowserPromise: Promise<Browser> | null = null;

  constructor() {
    dotenv.config();
    
    // Initialize GenKit with OpenAI plugin
    this.ai = genkit({
      plugins: [openAI({ apiKey: process.env.OPENAI_API_KEY })],
      model: gpt4oMini,
      
    });

    // Store API key for SerpAPI
    this.apiKey = process.env.SERPAPI_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('SerpAPI key not provided. Set SERPAPI_KEY in .env file or pass to constructor.');
    }

    // Initialize research tools
    this.researchTools = new ResearchTools();

    // Initialize search state
    this.researchState = {
      status: 'idle',
      currentTopic: '',
      thoughts: [],
      collectedInfo: new Map(),
      finalReport: '',
      currentStep: '',
      stepDetails: [],
    };

    // Initialize reports directory
    this.reportsDir = path.join(process.cwd(), 'reports');
    
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }

    // Define tools
    this.defineTools();
  }

  /**
   * Define all available tools using Genkit's tool definition system
   */
  private defineTools(): void {
    // Search web tool
    const searchWeb = this.ai.defineTool(
      {
        name: 'searchWeb',
        description: 'Search the web for information about a topic. Use this tool for initial research and to find relevant information.',
        inputSchema: z.object({
          query: z.string().describe('The search query'),
          numResults: z.number().optional().describe('Number of results to return')
        }),
        outputSchema: z.array(z.any())
      },
      async (input) => {
        console.log('Searching web for:', input.query);
        this.updateState('thinking', 'Web Search', `Searching for: ${input.query}`);
        try {
          const response = await getJson({
            api_key: this.apiKey,
            engine: 'google',
            device: 'mobile',
            q: input.query,
            num: input.numResults || 10,
          });
          const results = response.organic_results || [];

          this.updateState('acting', 'Web Search', `Found ${results.length} results for: ${input.query}\n ${results.map(r => r.title).join('\n')}`);
          this.addThought('action', `Found ${results.length} results for: ${input.query}`);
          return results;
        } catch (error) {
          console.error('Search error:', error);
          this.addThought('observation', `Error searching: ${(error as Error).message}`);
          return [];
        }
      }
    );

    // Extract content tool
    const extractWebContent = this.ai.defineTool(
      {
        name: 'extractWebContent',
        description: 'Extract content from a webpage. Use this to get detailed information from a specific web page.',
        inputSchema: z.object({
          url: z.string().url().describe('The URL to extract content from')
        }),
        outputSchema: z.string()
      },
      async (input) => {
        console.log('Extracting content from:', input.url);
        return await this.extractWebContent(input.url);
      }
    );

    // Compare information tool
    const compareInformation = this.ai.defineTool(
      {
        name: 'compareInformation',
        description: 'Compare information from different sources to identify agreements, contradictions, and unique insights.',
        inputSchema: z.object({
          sources: z.array(z.object({
            name: z.string(),
            content: z.string()
          })).describe('Array of sources to compare')
        }),
        outputSchema: z.string()
      },
      async (input) => {
        console.log('Comparing information sources');
        return await this.compareInformation(input.sources.map(s => s.content));
      }
    );

    // Fact checking queries tool
    const generateFactCheckingQueries = this.ai.defineTool(
      {
        name: 'generateFactCheckingQueries',
        description: 'Generate fact-checking queries for content to verify claims and statements.',
        inputSchema: z.object({
          content: z.string().describe('The content to generate queries for')
        }),
        outputSchema: z.array(z.string())
      },
      async (input) => {
        console.log('Generating fact checking queries');
        return await this.generateFactCheckingQueries(input.content);
      }
    );

    // Visualizations tool
    const suggestVisualizations = this.ai.defineTool(
      {
        name: 'suggestVisualizations',
        description: 'Suggest appropriate data visualizations for research findings.',
        inputSchema: z.object({
          data: z.string().describe('The data to suggest visualizations for')
        }),
        outputSchema: z.array(z.string())
      },
      async (input) => {
        console.log('Suggesting visualizations');
        return await this.suggestVisualizations(input.data);
      }
    );

    // Screenshot tool
    const captureScreenshot = this.ai.defineTool(
      {
        name: 'captureScreenshot',
        description: 'Capture a screenshot of a webpage for visual analysis.',
        inputSchema: z.object({
          url: z.string().url().describe('The URL to capture')
        }),
        outputSchema: z.any()
      },
      async (input) => {
        console.log('Capturing screenshot of:', input.url);
        return await this.researchTools.captureScreenshot(input.url);
      }
    );

    // Structured data tool
    const extractStructuredData = this.ai.defineTool(
      {
        name: 'extractStructuredData',
        description: 'Extract structured data from a webpage using CSS selectors.',
        inputSchema: z.object({
          url: z.string().url().describe('The URL to extract data from'),
          options: z.object({
            selectors: z.record(z.string()).describe('CSS selectors for data extraction')
          })
        }),
        outputSchema: z.record(z.string())
      },
      async (input) => {
        console.log('Extracting structured data from:', input.url);
        return await this.researchTools.extractStructuredData(input.url, input.options.selectors);
      }
    );

    // Generate report tool
    const generateResearchReport = this.ai.defineTool(
      {
        name: 'generateResearchReport',
        description: 'Generate a structured research report based on collected information.',
        inputSchema: z.object({
          topic: z.string().describe('The research topic'),
          findings: z.string().describe('The research findings'),
          structure: z.string().optional().describe('Optional report structure guidance')
        }),
        outputSchema: z.object({
          title: z.string(),
          sections: z.array(z.object({
            title: z.string(),
            content: z.string().optional(),
            subsections: z.array(z.object({
              title: z.string(),
              content: z.string()
            })).optional()
          }))
        })
      },
      async (input) => {
        console.log('Generating research report for:', input.topic);
        
        const prompt = `
          Create a comprehensive research report on "${input.topic}" based on the following findings:
          
          ${input.findings}
          
          ${input.structure ? `Use the following structure: ${input.structure}` : `
          Include the following sections:
          1. Executive Summary
          2. Key Findings/Statistics
          3. Analysis
          4. Implications
          5. Recommendations
          6. Sources
          
          For each section, provide a detailed content. Where appropriate, include subsections.`}
          
          Return the report as a structured JSON object with title and sections.
        `;
        
        const { text } = await this.ai.generate(prompt);
        
        try {
          return JSON.parse(text);
        } catch (error) {
          console.error('Error parsing report JSON:', error);
          return {
            title: `Research on ${input.topic}`,
            sections: [
              { 
                title: 'Error',
                content: `Error generating structured report: ${(error as Error).message}. Raw output: ${text}` 
              }
            ]
          };
        }
      }
    );

    // Store all tools in array
    this.tools = [
      searchWeb,
      extractWebContent,
      compareInformation,
      generateFactCheckingQueries,
      suggestVisualizations,
      captureScreenshot,
      extractStructuredData,
      generateResearchReport
    ];
  }

  /**
   * Update the search state and trigger UI updates
   */
  private updateState(status: 'idle' | 'thinking' | 'acting' | 'observing' | 'reporting', step: string, detail?: string): void {
    this.researchState.status = status;
    this.researchState.currentStep = step;
    
    if (detail) {
      this.researchState.stepDetails.push(detail);
      console.log(`[${status.toUpperCase()}] ${step}: ${detail}`);
    } else {
      console.log(`[${status.toUpperCase()}] ${step}`);
    }
  }

  /**
   * Add a thought or observation to the research state
   */
  private addThought(type: 'thought' | 'action' | 'observation', content: string): void {
    this.researchState.thoughts.push({
      type,
      content,
      timestamp: Date.now()
    });
  }

  /**
   * Initialize the browser for web scraping
   */
  private async initBrowser(): Promise<Browser> {
    // If there's no initialization promise yet, create one
    if (!this.initBrowserPromise) {
      this.initBrowserPromise = (async () => {
        try {
          if (!this.browser) {
            console.log('Initializing browser...');
            this.browser = await chromium.launch({
              headless: true,
              args: ['--no-sandbox']
            });
            console.log('Browser initialized successfully');
          }
          return this.browser;
        } catch (error) {
          console.error("Browser initialization error:", error);
          // Reset the promise so future calls can try again
          this.initBrowserPromise = null;
          throw new Error("Failed to initialize browser");
        }
      })();
    }
    
    // Always return the same promise to all callers
    return this.initBrowserPromise;
  }

  /**
   * Close the browser and free resources
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        console.log('Closing browser...');
        await this.browser.close();
        this.browser = null;
        this.initBrowserPromise = null;
        console.log('Browser closed successfully');
      } catch (error) {
        console.error("Browser closing error:", error);
      }
    }
  }

  /**
   * Extract content from a webpage using Playwright
   */
  private async extractWebContent(url: string): Promise<string> {
    try {
      const browser = await this.initBrowser();
      console.log('Browser initialized successfully');
      const context = await browser.newContext();
      console.log('Context initialized successfully');
      const page = await context.newPage();
      console.log(`Navigating to: ${url}`);
      
      // Add timeout for navigation
      await page.goto(url, { timeout: 30000 });
      
      // Wait for content to load with timeout
      await page.waitForSelector('body', { timeout: 10000 });
      
      const content = await page.evaluate(() => {
        // Remove unwanted elements
        const elementsToRemove = document.querySelectorAll('nav, header, footer, script, style, iframe');
        elementsToRemove.forEach(el => el.remove());
        
        // Get main content
        const mainContent = document.querySelector('main, article, .content, .article, .post') || document.body;
        return mainContent.textContent || '';
      });

      await context.close();
      return content.trim();
    } catch (error) {
      console.error(`Error extracting content from ${url}:`, error);
      return '';
    }
  }

  /**
   * Compare information from different sources
   */
  private async compareInformation(sources: string[]): Promise<string> {
    try {
      const prompt = `Compare and analyze the following information sources about "${this.researchState.currentTopic}":\n\n${sources.join('\n\n')}`;
      const response = await this.ai.generate(prompt);
      return response.text;
    } catch (error) {
      console.error('Error comparing information:', error);
      return '';
    }
  }

  /**
   * Generate fact-checking queries
   */
  private async generateFactCheckingQueries(content: string): Promise<string[]> {
    try {
      const prompt = `Generate fact-checking queries for the following content about "${this.researchState.currentTopic}":\n\n${content}`;
      const response = await this.ai.generate(prompt);
      return response.text.split('\n').filter(query => query.trim());
    } catch (error) {
      console.error('Error generating fact-checking queries:', error);
      return [];
    }
  }

  /**
   * Suggest visualizations for research data
   */
  private async suggestVisualizations(data: string): Promise<string[]> {
    try {
      const prompt = `Suggest data visualizations for the following content about "${this.researchState.currentTopic}":\n\n${data}`;
      const response = await this.ai.generate(prompt);
      return response.text.split('\n').filter(suggestion => suggestion.trim());
    } catch (error) {
      console.error('Error suggesting visualizations:', error);
      return [];
    }
  }

  /**
   * Conduct autonomous research on a topic by letting the AI decide which tools to use
   */
  public async research(topic: string): Promise<string> {
    try {
      console.log("\n🔍 Starting autonomous research on: " + topic);
      this.researchState.currentTopic = topic;
      this.updateState('thinking', 'Research Planning', 'Initiating research process');
      
      // Define the system prompt to guide the AI's research process
      const systemPrompt = `
        You are an expert research assistant tasked with investigating "${topic}".
        
        Follow these research guidelines:
        1. Start by searching for general information about the topic
        2. Extract and analyze content from the most relevant sources
        3. Compare information from different sources to identify agreements and contradictions
        4. Verify important claims and statistics through fact-checking
        5. Consider how the information could be visualized
        6. Summarize your findings in a structured research report
        
        Use the available tools strategically to conduct a thorough investigation.
        Think step-by-step about which tool is most appropriate at each stage of research.
        Provide clear reasoning for your decisions.
      `;
      
      // Start the research process with an initial prompt
      this.updateState('acting', 'AI Research', 'Starting autonomous research process');
      
      const initialPrompt = `
        ${systemPrompt}
        
        Conduct comprehensive research on "${topic}".
        
        1. Search for relevant information
        2. Analyze and synthesize findings
        3. Generate a structured research report with the following sections:
           - Executive Summary
           - Key Findings/Statistics
           - Analysis
           - Implications
           - Recommendations
           - Sources
        
        Work step-by-step and provide clear explanations for your research choices.
      `;
      
      // Use GenKit's generate with tools for autonomous tool selection
      const response = await this.ai.generate({
        prompt: initialPrompt,
        tools: this.tools,
        maxTurns: 1000
      });
      
      // Extract the final response text
      const researchResults = response.text;
      
      // Save and return the research report
      await this.saveReport(topic, researchResults);
      console.log("\n✅ Research completed successfully.");
      
      // Close browser to free resources
      await this.closeBrowser();
      
      return researchResults;
    } catch (error) {
      console.error("Error during research:", error);
      // Ensure browser is closed even if research fails
      await this.closeBrowser();
      throw error;
    }
  }

  /**
   * Get the current state of the search process
   * @returns Current search state
   */
  public getState(): any {
    return { ...this.researchState };
  }

  /**
   * Save the report to a file
   */
  private async saveReport(topic: string, content: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${topic.toLowerCase().replace(/\s+/g, '_')}_${timestamp}.md`;
    const filepath = path.join(this.reportsDir, filename);
    
    await fs.promises.writeFile(filepath, content, 'utf8');
    console.log(`Report saved to: ${filepath}`);
  }
} 