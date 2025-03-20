# DeepSearch 🧠

<p align="center">
  <img src="assets/logo.png" alt="DeepSearch Logo" width="200" height="200">
  <br>
  <em>Advanced AI-Powered Research with Tree of Thoughts Reasoning</em>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#examples">Examples</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

DeepSearch is a powerful TypeScript-based research tool that leverages advanced AI reasoning techniques to conduct comprehensive research on any topic. By implementing ReAct (Reasoning + Acting) and Tree of Thoughts methodologies, DeepSearch can explore complex subjects with human-like thought processes and generate detailed, insightful reports.

## Features

- 🧠 **Advanced AI Reasoning**: Implements multiple reasoning techniques including ReAct and Tree of Thoughts for deep exploratory research
- 🌐 **Autonomous Web Search**: Intelligently searches the web for relevant information and synthesizes findings
- 📊 **Comprehensive Analysis**: Evaluates information quality and explores multiple research paths
- 🔄 **Adaptive Research**: Dynamically adjusts research strategies based on findings
- 📑 **Structured Reports**: Generates well-organized, detailed research reports
- 🤔 **Human-Like Thinking**: Demonstrates visible reasoning process similar to Grok-3/Gemini advanced models

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Bun](https://bun.sh/) (v1.0 or higher)
- API keys for OpenAI and SerpAPI

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/DeepResearch.git
   cd DeepResearch
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Create a `.env` file in the root directory with your API keys:
   ```
   OPENAI_API_KEY=your_openai_key_here
   SERPAPI_KEY=your_serpapi_key_here
   ```

## Usage

Run DeepSearch by specifying a research topic:

```bash
bun run start "bitcoin price trend in this year"
```

The tool will:
1. Begin autonomous research on your topic
2. Show its thought process as it explores different perspectives
3. Search for relevant information on the web
4. Analyze findings in real-time
5. Generate a comprehensive report in the `reports` directory

## Examples

Here are some example research topics you can explore with DeepSearch:

- `"Impact of artificial intelligence on job market"`
- `"Climate change mitigation strategies"`
- `"Quantum computing advances in 2023"`
- `"Cryptocurrency market trends"`
- `"Emerging technologies in healthcare"`

## How It Works

DeepSearch leverages several advanced techniques to produce human-like research capabilities:

### Natural Thinking Process

DeepSearch implements a fluid thinking process that mimics how humans approach research problems:

```typescript
// Example of natural thinking prompt implementation
const openThinkingPrompt = `You're researching: "${topic}"

Context so far: 
${context}

Think through this research question. Explore different aspects, consider what information 
you need, what might be interesting to explore, and how you'll approach finding answers.

Think step by step, exploring different facets of the topic. Don't structure your thoughts in any 
particular way - just think naturally as you would when researching something interesting.`;
```

### Sample Output:

```
Thinking about this research question...

When researching the bitcoin price trend for the current year, it is crucial to consider multiple 
facets and gather diverse types of information to get a comprehensive understanding of its trajectory.

1. Historical Price Data: Begin by collecting detailed historical bitcoin price data for this year.
   This includes daily, weekly, and monthly price changes. Platforms like CoinMarketCap, CoinGecko, 
   or Yahoo Finance can be useful for retrieving this data.

2. Major Events and News: Identify significant events that have impacted or could impact bitcoin 
   prices this year. This includes regulatory news, technological developments, economic announcements...
```

### Tree of Thoughts Reasoning

Unlike traditional AI, DeepSearch explores multiple reasoning paths and backtracks when a path isn't fruitful:

```typescript
// Dynamic path selection
if (score > 0.7) {
  return 'continue'; // Continue with current line of inquiry
} else if (score > 0.4) {
  // Strategic backoff - occasionally explore alternatives
  return Math.random() < 0.7 ? 'continue' : 'explore_new';
} else {
  // Low-confidence results suggest exploring a different path
  return Math.random() < 0.5 ? 'backtrack' : 'explore_new';
}
```

### Autonomous Tool Selection

The system intelligently chooses which research tools to use based on context:

```typescript
// Tool selection example
const toolRequest = await selectTool(researchContext);
console.log(`Selected tool: ${toolRequest.name} with parameters:`, toolRequest.input);

// Tool execution with graceful error handling
try {
  const result = await selectedTool.handle(toolRequest.input);
  // Process and analyze results...
} catch (error) {
  console.log("Error using tool, falling back to alternative approach...");
  // Implement fallback strategy...
}
```

### Information Synthesis

DeepSearch doesn't just collect information - it synthesizes findings into coherent insights:

```typescript
// Information analysis and synthesis 
const analysisPrompt = `You searched for "${query}" and found these results:
${JSON.stringify(results.slice(0, 3), null, 2)}

Analyze these search results. What interesting information do you find? 
What patterns do you notice? What's missing? What new questions arise?`;

const { text: analysis } = await this.ai.generate(analysisPrompt);
```

### Example Analysis Output:

```
Analyzing these results...

The search results for "Bitcoin price trend in this year" reveal several key insights:

1. Sources and Credibility: The results come from reputable financial platforms including Yahoo Finance,
   Investopedia, and CoinDesk. These are established sources for cryptocurrency and financial information,
   suggesting reliability in the data presented.

2. Price Fluctuations: According to one result, Bitcoin has shown a 3.06% increase over the last week,
   but a significant monthly decrease of 11.02%. Year-to-date, however, it shows growth of 26.68%. 
   This indicates considerable volatility within an overall positive yearly trend.

3. What's Missing: The results lack detailed analysis of causative factors behind these price movements.
   There's little information about regulatory developments, technological advances, or macroeconomic factors
   that might be driving these changes.
```

## Architecture

DeepSearch consists of several core components:

- **ReasoningEngine**: Implements the cognitive reasoning process using advanced AI techniques
- **BrowserManager**: Handles web browsing and content extraction
- **ToolRegistry**: Manages the research tools available to the system
- **ResearchStateManager**: Tracks and manages the state of the research process
- **ReportGenerator**: Creates structured reports from research findings

## Future Enhancements

- [ ] Support for additional language models
- [ ] Enhanced visualization capabilities for research findings
- [ ] Specialized research modes for academic, business, and technical topics
- [ ] Improved multi-source fact checking
- [ ] Collaborative research capabilities

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenAI for providing the language model capabilities
- SerpAPI for web search functionality
- The research community for advancing Tree of Thoughts and ReAct methodologies

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/yourusername">Your Name</a>
</p>
