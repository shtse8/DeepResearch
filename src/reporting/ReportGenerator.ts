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
    console.log(`\n📝 Generating comprehensive research report on: ${topic}`);
    
    // Generate reasoning analysis
    console.log(`• Analyzing research reasoning process...`);
    const reasoningAnalysis = await this.generateReasoningAnalysis(exploredPaths);
    
    // Extract key insights from findings
    console.log(`• Extracting key insights from collected data...`);
    const { keyInsights } = await this.extractKeyInsights(findings, topic);
    
    // Generate main report content with enhanced structure
    console.log(`• Structuring final report with insights...`);
    const reportPrompt = `
      Create a comprehensive research report on "${topic}" based on the following findings:
      
      ${findings}
      
      Key insights identified:
      ${keyInsights}
      
      Include the following sections:
      1. Executive Summary - Brief overview of key findings and conclusions
      2. Introduction - Context and background about ${topic}
      3. Key Findings - Main discoveries organized by themes
      4. Data Analysis - Statistical or qualitative analysis of the information
      5. Trends and Patterns - Identified trends, correlations, or patterns
      6. Expert Opinions - Summary of expert views and perspectives
      7. Implications - What these findings mean for stakeholders
      8. Future Outlook - Predictions and forecasts based on current data
      9. Recommendations - Actionable insights for decision-makers
      10. Sources and References - List of information sources
      
      For each section, provide detailed content with supporting evidence from the findings.
      Where appropriate, include subsections to organize complex information.
      Write in a clear, professional style with data-driven insights.
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
    
    // Generate data visualizations recommendations
    console.log(`• Suggesting data visualizations...`);
    const visualizationSuggestions = await this.generateVisualizationSuggestions(findings, topic);
    
    // Create final report with enhanced metadata
    const report: ResearchReport = {
      topic,
      searchResults: findings,
      sections: output.sections,
      reasoningProcess: {
        exploredPaths,
        confidenceScores: this.extractConfidenceScores(exploredPaths),
        reasoningAnalysis
      },
      toolsUsed: formattedToolUsage,
      insights: {
        keyInsights,
        visualizationSuggestions
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        researchDuration: this.calculateResearchDuration(exploredPaths),
        sourcesExamined: this.countUniqueSources(findings),
        confidenceScore: this.calculateOverallConfidence(exploredPaths)
      }
    };
    
    console.log(`✅ Report generation complete with ${report.sections.length} sections`);
    
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
    
    // Generate markdown content with enhanced formatting
    let markdown = `# ${report.topic}\n\n`;
    markdown += `*Generated on ${new Date().toLocaleString()}*\n\n`;
    markdown += `---\n\n`;
    
    // Add an executive summary first
    const summarySection = report.sections.find(s => s.title.toLowerCase().includes('summary') || s.title.toLowerCase().includes('overview'));
    if (summarySection && summarySection.content) {
      markdown += `## Executive Summary\n\n`;
      markdown += `${summarySection.content.trim()}\n\n`;
      markdown += `---\n\n`;
    }
    
    // Table of Contents
    markdown += `## Table of Contents\n\n`;
    for (const section of report.sections) {
      // Skip the summary since we already included it
      if (section === summarySection) continue;
      
      markdown += `- [${section.title}](#${this.slugify(section.title)})\n`;
      if (section.subsections && section.subsections.length > 0) {
        for (const subsection of section.subsections) {
          markdown += `  - [${subsection.title}](#${this.slugify(subsection.title)})\n`;
        }
      }
    }
    markdown += `\n---\n\n`;
    
    // Add sections (except the summary which was already added)
    for (const section of report.sections) {
      // Skip the summary since we already included it
      if (section === summarySection) continue;
      
      markdown += `## ${section.title}\n\n`;
      
      if (section.content) {
        markdown += `${section.content.trim()}\n\n`;
      }
      
      // Add subsections
      if (section.subsections && section.subsections.length > 0) {
        for (const subsection of section.subsections) {
          markdown += `### ${subsection.title}\n\n`;
          markdown += `${subsection.content.trim()}\n\n`;
        }
      }
      
      markdown += `---\n\n`;
    }
    
    // Add research methodology
    markdown += `## Research Methodology\n\n`;
    markdown += `This report was generated using a multi-step reasoning process `;
    markdown += `that explored various perspectives and information sources.\n\n`;
    
    // Add visualization of the research process
    markdown += `### Research Process Flow\n\n`;
    markdown += `\`\`\`\n`;
    markdown += `Research Topic → Initial Planning → Data Collection → Analysis → Synthesis → Report Generation\n`;
    markdown += `\`\`\`\n\n`;
    
    // Add tool usage information
    if (report.toolsUsed && report.toolsUsed.length > 0) {
      markdown += `### Tools Used\n\n`;
      markdown += `| Tool | Purpose | Usage Count |\n`;
      markdown += `| ---- | ------- | ----------- |\n`;
      for (const tool of report.toolsUsed) {
        markdown += `| ${tool.name} | ${tool.purpose} | ${tool.timesUsed} |\n`;
      }
      markdown += `\n`;
    }
    
    // Add reasoning process visualization if available
    if (report.reasoningProcess && report.reasoningProcess.exploredPaths.length > 0) {
      markdown += `### Key Research Paths\n\n`;
      
      const topPaths = report.reasoningProcess.exploredPaths
        .filter(p => p.type === 'thought' && p.confidence && p.confidence > 0.6)
        .slice(0, 5);
      
      if (topPaths.length > 0) {
        for (const path of topPaths) {
          const confidenceStars = '★'.repeat(Math.round((path.confidence || 0) * 5));
          markdown += `- **Path**: ${path.content.split('\n')[0]}\n`;
          markdown += `  - **Confidence**: ${confidenceStars} (${(path.confidence || 0).toFixed(2)})\n\n`;
        }
      }
    }
    
    // Save to file
    await fs.promises.writeFile(filepath, markdown, 'utf8');
    console.log(`\n📊 Report saved to: ${filepath}`);
    
    return filepath;
  }
  
  /**
   * Convert a string to a URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');
  }

  /**
   * Extract key insights from the collected findings
   */
  private async extractKeyInsights(findings: string, topic: string): Promise<{ keyInsights: string }> {
    const prompt = `
      From the following research findings on "${topic}", extract 5-7 key insights that represent
      the most significant discoveries or conclusions:
      
      ${findings.substring(0, 3000)}
      
      For each insight:
      1. State it clearly and concisely
      2. Include any relevant supporting data points
      3. Indicate confidence level (high/medium/low)
      
      Format each insight as a bullet point with a concise headline and brief explanation.
    `;
    
    const { text } = await this.ai.generate(prompt);
    return { keyInsights: text };
  }
  
  /**
   * Generate visualization suggestions based on the findings
   */
  private async generateVisualizationSuggestions(findings: string, topic: string): Promise<string> {
    const prompt = `
      Based on the research findings about "${topic}", suggest 3-5 data visualizations that would
      effectively communicate key insights:
      
      ${findings.substring(0, 3000)}
      
      For each visualization:
      1. Specify the type (e.g., bar chart, timeline, heatmap)
      2. Describe what data would be visualized
      3. Explain what insight it would highlight
      4. Note any special considerations for implementation
    `;
    
    const { text } = await this.ai.generate(prompt);
    return text;
  }
  
  /**
   * Calculate the total research duration based on the timestamps
   */
  private calculateResearchDuration(paths: Thought[]): string {
    if (paths.length < 2) return "Unknown duration";
    
    const startTime = Math.min(...paths.map(p => p.timestamp));
    const endTime = Math.max(...paths.map(p => p.timestamp));
    
    const durationMs = endTime - startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${minutes} minutes, ${seconds} seconds`;
  }
  
  /**
   * Count the number of unique sources examined in the findings
   */
  private countUniqueSources(findings: string): number {
    // Simple approach to count URLs in the findings
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = findings.match(urlRegex) || [];
    
    // Extract domains and count unique ones
    const domains = new Set();
    urls.forEach(url => {
      try {
        const domain = new URL(url).hostname;
        domains.add(domain);
      } catch (e) {
        // Ignore invalid URLs
      }
    });
    
    return domains.size || 1; // At least 1 source
  }
  
  /**
   * Calculate overall confidence based on explored paths
   */
  private calculateOverallConfidence(paths: Thought[]): number {
    const confidenceScores = paths
      .filter(p => p.confidence !== undefined)
      .map(p => p.confidence as number);
    
    if (confidenceScores.length === 0) return 0.5;
    
    const sum = confidenceScores.reduce((acc, val) => acc + val, 0);
    return parseFloat((sum / confidenceScores.length).toFixed(2));
  }
} 