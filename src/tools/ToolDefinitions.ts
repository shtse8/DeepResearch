import { genkit, z } from "genkit";
import type { Genkit, ToolAction } from "genkit";
import { BrowserManager } from "../browser/BrowserManager";
import { getJson } from 'serpapi';
import type { ZodTypeAny } from "zod";
import type { EnhancedToolAction } from "../reasoning/ReasoningEngine";

// Interface for our enhanced tool type
export interface ResearchTool<TInput extends ZodTypeAny, TOutput extends ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  handle: (input: z.infer<TInput>) => Promise<z.infer<TOutput>>;
}

/**
 * Defines and creates research tools
 */
export class ToolRegistry {
  private ai: Genkit;
  private browserManager: BrowserManager;
  private serpApiKey: string;

  constructor(ai: Genkit, browserManager: BrowserManager, serpApiKey: string) {
    this.ai = ai;
    this.browserManager = browserManager;
    this.serpApiKey = serpApiKey;
  }

  private toolToAction(tool: ResearchTool<any, any>): EnhancedToolAction<any, any> {
    const action = this.ai.defineTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema
    }, tool.handle);

    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      handle: tool.handle,
      __action: action
    };
  }

  /**
   * Get all research tools
   */
  public getTools(): EnhancedToolAction<any, any>[] {
    return [
      this.toolToAction(this.createSearchWebTool()),
      this.toolToAction(this.createExtractWebContentTool()),
      this.toolToAction(this.createCompareInformationTool()),
      this.toolToAction(this.createFactCheckingQueriesTool()),
      this.toolToAction(this.createSuggestVisualizationsTool()),
      this.toolToAction(this.createCaptureScreenshotTool()),
      this.toolToAction(this.createExtractStructuredDataTool()),
      this.toolToAction(this.createGenerateResearchReportTool())
    ];
  }

  /**
   * Create search web tool
   */
  private createSearchWebTool(): ResearchTool<any, any> {
    return {
      name: 'searchWeb',
      description: 'Search the web for information about a topic. Use this tool for initial research and to find relevant information.',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
        numResults: z.number().optional().describe('Number of results to return')
      }),
      outputSchema: z.array(z.any()),
      handle: async (input) => {
        console.log('Searching web for:', input.query);
        try {
          const response = await getJson({
            api_key: this.serpApiKey,
            engine: 'google',
            device: 'mobile',
            q: input.query,
            num: input.numResults || 10,
          });
          return response.organic_results || [];
        } catch (error) {
          console.error('Search error:', error);
          return [];
        }
      }
    };
  }

  /**
   * Create extract web content tool
   */
  private createExtractWebContentTool(): ResearchTool<any, any> {
    return {
      name: 'extractWebContent',
      description: 'Extract content from a webpage. Use this to get detailed information from a specific web page.',
      inputSchema: z.object({
        url: z.string().url().describe('The URL to extract content from')
      }),
      outputSchema: z.string(),
      handle: async (input) => {
        console.log('Extracting content from:', input.url);
        return await this.browserManager.extractWebContent(input.url);
      }
    };
  }

  /**
   * Create compare information tool
   */
  private createCompareInformationTool(): ResearchTool<any, any> {
    return {
      name: 'compareInformation',
      description: 'Compare information from different sources to identify agreements, contradictions, and unique insights.',
      inputSchema: z.object({
        sources: z.array(z.object({
          name: z.string(),
          content: z.string()
        })).describe('Array of sources to compare')
      }),
      outputSchema: z.string(),
      handle: async (input) => {
        console.log('Comparing information sources');
        const prompt = `
          Compare and analyze the following information sources:
          
          ${input.sources.map((source: { name: string; content: string }) => `SOURCE: ${source.name}\n${source.content}\n\n`).join('')}
          
          Provide a detailed analysis that:
          1. Identifies key agreements between sources
          2. Highlights contradictions or differences
          3. Extracts unique insights from each source
          4. Evaluates the overall reliability of the information
        `;
        
        const { text } = await this.ai.generate(prompt);
        return text;
      }
    };
  }

  /**
   * Create fact checking queries tool
   */
  private createFactCheckingQueriesTool(): ResearchTool<any, any> {
    return {
      name: 'generateFactCheckingQueries',
      description: 'Generate fact-checking queries for content to verify claims and statements.',
      inputSchema: z.object({
        content: z.string().describe('The content to generate queries for')
      }),
      outputSchema: z.array(z.string()),
      handle: async (input) => {
        console.log('Generating fact checking queries');
        const prompt = `
          For the following content, generate specific search queries that would help verify
          the accuracy of important claims and statements:
          
          ${input.content}
          
          For each query:
          1. Target a specific factual claim
          2. Create a search query that would return reliable verification sources
          3. Focus on the most important or potentially controversial claims
          
          Return each query on a new line, with no additional text or numbering.
        `;
        
        const { text } = await this.ai.generate(prompt);
        return text.split('\n').filter(line => line.trim().length > 0);
      }
    };
  }

  /**
   * Create visualization suggestions tool
   */
  private createSuggestVisualizationsTool(): ResearchTool<any, any> {
    return {
      name: 'suggestVisualizations',
      description: 'Suggest appropriate data visualizations for research findings.',
      inputSchema: z.object({
        data: z.string().describe('The data to suggest visualizations for')
      }),
      outputSchema: z.array(z.object({
        type: z.string(),
        description: z.string(),
        dataPoints: z.string(),
        rationale: z.string()
      })),
      handle: async (input) => {
        console.log('Suggesting visualizations');
        const prompt = `
          Based on the following research data, suggest appropriate data visualizations
          that would effectively communicate the key insights:
          
          ${input.data}
          
          For each visualization, specify:
          1. The type of visualization (e.g., bar chart, timeline, etc.)
          2. A brief description of what it would show
          3. The key data points it would include
          4. Why this visualization would be effective
        `;
        
        const { output } = await this.ai.generate({
          prompt,
          output: {
            schema: z.array(z.object({
              type: z.string(),
              description: z.string(),
              dataPoints: z.string(),
              rationale: z.string()
            }))
          }
        });
        
        return output || [];
      }
    };
  }

  /**
   * Create screenshot tool
   */
  private createCaptureScreenshotTool(): ResearchTool<any, any> {
    return {
      name: 'captureScreenshot',
      description: 'Capture a screenshot of a webpage for visual analysis.',
      inputSchema: z.object({
        url: z.string().url().describe('The URL to capture')
      }),
      outputSchema: z.any(),
      handle: async (input) => {
        console.log('Capturing screenshot of:', input.url);
        return await this.browserManager.captureScreenshot(input.url);
      }
    };
  }

  /**
   * Create structured data extraction tool
   */
  private createExtractStructuredDataTool(): ResearchTool<any, any> {
    return {
      name: 'extractStructuredData',
      description: 'Extract structured data from a webpage using CSS selectors.',
      inputSchema: z.object({
        url: z.string().url().describe('The URL to extract data from'),
        options: z.object({
          selectors: z.record(z.string()).describe('CSS selectors for data extraction')
        })
      }),
      outputSchema: z.record(z.string()),
      handle: async (input) => {
        console.log('Extracting structured data from:', input.url);
        return await this.browserManager.extractStructuredData(input.url, input.options.selectors);
      }
    };
  }

  /**
   * Create research report generation tool
   */
  private createGenerateResearchReportTool(): ResearchTool<any, any> {
    return {
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
      }),
      handle: async (input) => {
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
          
          For each section, provide detailed content. Where appropriate, include subsections.`}
          
          Return the report as a structured JSON object with title and sections.
        `;
        
        const { output } = await this.ai.generate({
          prompt, 
          output: {
            schema: z.object({
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
          } 
        });
        
        if (!output) {
          throw new Error('No output from generateResearchReport tool');
        }
        
        return output;
      }
    };
  }
} 