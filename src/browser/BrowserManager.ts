import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';

/**
 * BrowserManager - Manages browser session for web scraping and interactions
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private currentPage: Page | null = null;
  private initBrowserPromise: Promise<Browser> | null = null;

  /**
   * Initialize the browser for web interactions
   */
  public async initBrowser(): Promise<Browser> {
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
   * Create a new page for web interactions
   */
  public async getPage(): Promise<Page> {
    const browser = await this.initBrowser();
    
    if (!this.context) {
      this.context = await browser.newContext();
    }
    
    if (!this.currentPage) {
      this.currentPage = await this.context.newPage();
    }
    
    return this.currentPage;
  }

  /**
   * Extract content from a webpage
   * @param url URL to extract content from
   * @returns Extracted content as string
   */
  public async extractWebContent(url: string): Promise<string> {
    try {
      const page = await this.getPage();
      console.log(`Navigating to: ${url}`);
      
      // Add timeout for navigation
      await page.goto(url, { 
        timeout: 30000,
        waitUntil: 'domcontentloaded'
      });
      
      // Wait for content to load with timeout
      await page.waitForSelector('body', { timeout: 10000 });
      
      const content = await page.evaluate(() => {
        // Remove unwanted elements
        const elementsToRemove = document.querySelectorAll('nav, header, footer, script, style, iframe, .ads, .banner, .cookie-notice');
        elementsToRemove.forEach(el => el.remove());
        
        // Get main content
        const mainContent = document.querySelector('main, article, .content, .article, .post') || document.body;
        return mainContent.textContent || '';
      });

      return content.trim();
    } catch (error) {
      console.error(`Error extracting content from ${url}:`, error);
      return '';
    }
  }

  /**
   * Take a screenshot of a webpage
   * @param url URL to capture
   * @returns Buffer containing the screenshot image
   */
  public async captureScreenshot(url: string): Promise<Buffer | null> {
    try {
      const page = await this.getPage();
      
      // Add timeout for the entire operation
      const timeoutPromise = new Promise<Buffer | null>((_, reject) => {
        setTimeout(() => reject(new Error(`Screenshot timeout for: ${url}`)), 30000);
      });
      
      const screenshotPromise = (async () => {
        try {
          await page.goto(url, { 
            timeout: 20000, 
            waitUntil: 'domcontentloaded' 
          });
          
          // Wait for content to load
          await page.waitForTimeout(2000);
          
          // Take a screenshot
          return await page.screenshot();
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
   * Extract structured data from a webpage using selectors
   * @param url URL to extract from
   * @param selectors Object with CSS selectors as keys
   * @returns Object with extracted data
   */
  public async extractStructuredData(url: string, selectors: Record<string, string>): Promise<Record<string, string>> {
    try {
      const page = await this.getPage();
      
      // Add timeout for the entire operation
      const timeoutPromise = new Promise<Record<string, string>>((_, reject) => {
        setTimeout(() => reject(new Error(`Extraction timeout for: ${url}`)), 30000);
      });
      
      const extractionPromise = (async () => {
        try {
          await page.goto(url, { 
            timeout: 20000, 
            waitUntil: 'domcontentloaded' 
          });
          
          const result: Record<string, string> = {};
          
          // Extract data for each selector
          for (const [key, selector] of Object.entries(selectors)) {
            try {
              const element = await page.$(selector);
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
   * Close the browser and free resources
   */
  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        console.log('Closing browser...');
        await this.browser.close();
        this.browser = null;
        this.context = null;
        this.currentPage = null;
        this.initBrowserPromise = null;
        console.log('Browser closed successfully');
      } catch (error) {
        console.error("Browser closing error:", error);
      }
    }
  }
} 