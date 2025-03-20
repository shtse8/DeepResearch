import type { Genkit } from "genkit";
import { z } from "genkit";
import type { ResearchReport, Thought } from "../types";
import path from 'path';
import fs from 'fs';

/**
 * Handles the generation and formatting of research reports
 */
export class ReportGenerator {
  private ai: Genkit;
  private reportsDir: string;

  constructor(ai: Genkit) {
    this.ai = ai;
    
    // Initialize reports directory
    this.reportsDir = path.join(process.cwd(), 'reports');
    
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate a comprehensive research report based on the findings
   */
  public async generateReport(
    topic: string, 
    findings: string, 
    exploredPaths: Thought[],
    toolUsage: Record<string, number>
  ): Promise<ResearchReport> {
    console.log(`Generating research report for topic: ${topic}`);
    
    // Generate reasoning analysis
    const reasoningAnalysis = await this.generateReasoningAnalysis(exploredPaths);
    
    // Generate main report content
    const reportPrompt = `
      Create a comprehensive research report on "${topic}" based on the following findings:
      
      ${findings}
      
      Include the following sections:
      1. Executive Summary
      2. Key Findings/Statistics
      3. Analysis
      4. Implications
      5. Recommendations
      6. Sources
      
      For each section, provide detailed content. Where appropriate, include subsections.
    `;
    
    const { output } = await this.ai.generate({
      prompt: reportPrompt,
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
      throw new Error("Failed to generate research report");
    }
    
    // Format tool usage
    const formattedToolUsage = Object.entries(toolUsage).map(([name, count]) => ({
      name,
      purpose: this.getToolPurpose(name),
      timesUsed: count
    }));
    
    // Create final report
    const report: ResearchReport = {
      topic,
      searchResults: findings,
      sections: output.sections,
      reasoningProcess: {
        exploredPaths,
        confidenceScores: this.extractConfidenceScores(exploredPaths)
      },
      toolsUsed: formattedToolUsage
    };
    
    return report;
  }

  /**
   * Generate analysis of the reasoning process
   */
  private async generateReasoningAnalysis(paths: Thought[]): Promise<string> {
    if (paths.length === 0) return "No reasoning paths explored.";
    
    const pathDescriptions = paths
      .map(path => `${path.type.toUpperCase()}: ${path.content} (confidence: ${path.confidence || 'unknown'})`)
      .join('\n\n');
    
    const prompt = `
      Analyze the following reasoning process used in the research:
      
      ${pathDescriptions}
      
      Provide insights into:
      1. The overall research approach
      2. Key decision points and their effectiveness
      3. Alternative paths that could have been explored
      4. Strengths and weaknesses of the reasoning process
    `;
    
    const { text } = await this.ai.generate(prompt);
    return text;
  }

  /**
   * Extract confidence scores from thought paths
   */
  private extractConfidenceScores(paths: Thought[]): Record<string, number> {
    const scores: Record<string, number> = {};
    
    for (const path of paths) {
      if (path.confidence !== undefined) {
        scores[path.id] = path.confidence;
      }
    }
    
    return scores;
  }

  /**
   * Get the purpose description for a tool
   */
  private getToolPurpose(toolName: string): string {
    const toolDescriptions: Record<string, string> = {
      searchWeb: "Finding relevant information on the web",
      extractWebContent: "Extracting detailed content from web pages",
      compareInformation: "Comparing information from different sources",
      generateFactCheckingQueries: "Verifying facts and claims",
      suggestVisualizations: "Suggesting effective data visualizations",
      captureScreenshot: "Capturing visual content from web pages",
      extractStructuredData: "Extracting specific data elements from web pages",
      generateResearchReport: "Generating the final research report"
    };
    
    return toolDescriptions[toolName] || "General research purposes";
  }

  /**
   * Format and save the report to a file
   */
  public async saveReport(report: ResearchReport): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedTopic = report.topic.toLowerCase().replace(/\s+/g, '_');
    const filename = `${sanitizedTopic}_${timestamp}.md`;
    const filepath = path.join(this.reportsDir, filename);
    
    // Generate markdown content
    let markdown = `# ${report.topic}\n\n`;
    
    // Add sections
    for (const section of report.sections) {
      markdown += `## ${section.title}\n\n`;
      
      if (section.content) {
        markdown += `${section.content}\n\n`;
      }
      
      // Add subsections
      if (section.subsections && section.subsections.length > 0) {
        for (const subsection of section.subsections) {
          markdown += `### ${subsection.title}\n\n`;
          markdown += `${subsection.content}\n\n`;
        }
      }
    }
    
    // Add reasoning process information if available
    if (report.reasoningProcess && report.reasoningProcess.exploredPaths.length > 0) {
      markdown += `## Research Methodology\n\n`;
      markdown += `This report was generated using a multi-step reasoning process `;
      markdown += `that explored various perspectives and information sources.\n\n`;
      
      // Add tool usage information
      if (report.toolsUsed && report.toolsUsed.length > 0) {
        markdown += `### Tools Used\n\n`;
        for (const tool of report.toolsUsed) {
          markdown += `- **${tool.name}**: ${tool.purpose} (used ${tool.timesUsed} times)\n`;
        }
        markdown += `\n`;
      }
    }
    
    // Save to file
    await fs.promises.writeFile(filepath, markdown, 'utf8');
    console.log(`Report saved to: ${filepath}`);
    
    return filepath;
  }
} 