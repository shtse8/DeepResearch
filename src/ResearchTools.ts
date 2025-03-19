import { genkit, z } from "genkit";
import { openAI } from "genkitx-openai";
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * ResearchTools - A helper class providing additional research capabilities.
 */
export class ResearchTools {
  private ai;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private currentPage: Page | null = null;

  constructor() {
    // Initialize GenKit with OpenAI plugin
    this.ai = genkit({
      plugins: [openAI({ apiKey: process.env.OPENAI_API_KEY })],
    });
  }

  /**
   * Initialize the browser for web interactions
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
      this.context = await this.browser.newContext();
      this.currentPage = await this.context.newPage();
    }
  }

  /**
   * Take a screenshot of a webpage
   * @param url URL to capture
   * @returns Buffer containing the screenshot image
   */
  public async captureScreenshot(url: string): Promise<Buffer | null> {
    try {
      await this.initBrowser();
      
      if (!this.currentPage) {
        throw new Error('Browser initialization failed');
      }
      
      // Add timeout for the entire operation
      const timeoutPromise = new Promise<Buffer | null>((_, reject) => {
        setTimeout(() => reject(new Error(`Screenshot timeout for: ${url}`)), 30000);
      });
      
      const screenshotPromise = (async () => {
        try {
          await this.currentPage!.goto(url, { 
            timeout: 20000, 
            waitUntil: 'domcontentloaded' 
          });
          
          // Wait for content to load
          await this.currentPage!.waitForTimeout(2000);
          
          // Take a screenshot
          return await this.currentPage!.screenshot();
        } catch (e) {
          console.error(`Error capturing screenshot for ${url}:`, e);
          return null;
        }
      })();
      
      // Race the screenshot against timeout
      return await Promise.race([screenshotPromise, timeoutPromise])
        .catch(error => {
          console.error(`Screenshot error or timeout: ${error.message}`);
          return null;
        });
    } catch (error) {
      console.error(`Error capturing screenshot: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Extract specific data from a webpage using selectors
   * @param url URL to extract from
   * @param selectors Object with CSS selectors as keys
   * @returns Object with extracted data
   */
  public async extractStructuredData(url: string, selectors: Record<string, string>): Promise<Record<string, string>> {
    try {
      await this.initBrowser();
      
      if (!this.currentPage) {
        throw new Error('Browser initialization failed');
      }
      
      // Add timeout for the entire operation
      const timeoutPromise = new Promise<Record<string, string>>((_, reject) => {
        setTimeout(() => reject(new Error(`Extraction timeout for: ${url}`)), 30000);
      });
      
      const extractionPromise = (async () => {
        try {
          await this.currentPage!.goto(url, { 
            timeout: 20000, 
            waitUntil: 'domcontentloaded' 
          });
          
          const result: Record<string, string> = {};
          
          // Extract data for each selector
          for (const [key, selector] of Object.entries(selectors)) {
            try {
              const element = await this.currentPage!.$(selector);
              if (element) {
                const text = await element.textContent();
                result[key] = text?.trim() || '';
              } else {
                result[key] = '';
              }
            } catch (err) {
              console.error(`Error extracting selector ${selector}:`, err);
              result[key] = '';
            }
          }
          
          return result;
        } catch (e) {
          console.error(`Error extracting data from ${url}:`, e);
          return {};
        }
      })();
      
      // Race the extraction against timeout
      return await Promise.race([extractionPromise, timeoutPromise])
        .catch(error => {
          console.error(`Extraction error or timeout: ${error.message}`);
          return {};
        });
    } catch (error) {
      console.error(`Error extracting structured data: ${(error as Error).message}`);
      return {};
    }
  }

  /**
   * Compare information from different sources
   * @param sources Array of objects with source name and content
   * @returns Analysis of the comparison
   */
  public async compareInformation(sources: Array<{ name: string; content: string }>): Promise<string> {
    try {
      const prompt = `
        Compare the following information from different sources and analyze:
        1. Areas of agreement
        2. Contradictions or differences
        3. Unique insights from each source
        4. Overall credibility assessment
        
        ${sources.map(source => `SOURCE: ${source.name}\n${source.content}\n\n`).join('')}
        
        Provide a detailed analysis of how these sources compare with each other.
      `;
      
      const { text } = await this.ai.generate(prompt);
      
      return text;
    } catch (error) {
      console.error(`Error comparing information: ${(error as Error).message}`);
      return `Error comparing information: ${(error as Error).message}`;
    }
  }

  /**
   * Generate fact-checking queries for verification
   * @param statements Array of statements to verify
   * @returns Array of suggested fact-checking queries
   */
  public async generateFactCheckingQueries(statements: string[]): Promise<string[]> {
    try {
      const prompt = `
        For each of the following statements, generate a specific search query 
        that would help verify its accuracy:
        
        ${statements.map((statement, index) => `${index + 1}. ${statement}`).join('\n')}
        
        For each statement, provide ONLY the search query without any additional text or numbering.
        Each query should be designed to efficiently check the factual accuracy of the statement.
      `;
      
      const { text } = await this.ai.generate(prompt);
      
      // Extract queries (one per line)
      return text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } catch (error) {
      console.error(`Error generating fact-checking queries: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Generate visualization suggestions for the research data
   * @param data Research data
   * @returns Visualization suggestions
   */
  public async suggestVisualizations(data: string): Promise<string> {
    try {
      const prompt = `
        Based on the following research data, suggest appropriate data visualizations 
        that would effectively communicate the key insights:
        
        ${data}
        
        For each suggested visualization:
        1. Describe the type of visualization (e.g., bar chart, timeline, heatmap)
        2. Explain what data it would display
        3. Describe how it would benefit the audience's understanding
        
        Provide concrete, practical suggestions that could be implemented by a data visualization specialist.
      `;
      
      const { text } = await this.ai.generate(prompt);
      
      return text;
    } catch (error) {
      console.error(`Error suggesting visualizations: ${(error as Error).message}`);
      return `Error suggesting visualizations: ${(error as Error).message}`;
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.currentPage = null;
    }
  }
} 