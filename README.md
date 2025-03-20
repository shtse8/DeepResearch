# DeepResearch

DeepResearch is an advanced research tool that uses Tree of Thoughts reasoning and ReAct (Reasoning + Acting) for deep, multi-step reasoning during research tasks.

## Features

- **Advanced Reasoning**: Implements Tree of Thoughts architecture for exploring multiple reasoning pathways
- **Self-evaluation**: Evaluates the quality of research outcomes and adjusts reasoning paths accordingly
- **Strategic Tool Selection**: Intelligently selects the most appropriate tool for each research step
- **Comprehensive Reports**: Generates detailed research reports with structured sections and insights
- **Web Research**: Automatically searches and extracts information from web sources
- **Multi-hop Reasoning**: Supports complex, multi-step reasoning processes
- **Backtracking**: Can backtrack from unproductive paths to explore alternatives

## Architecture

DeepResearch uses a modular architecture:

- `src/DeepSearch.ts` - Main entry point and controller
- `src/state/` - Research state management
- `src/reasoning/` - Reasoning engine with ReAct and Tree of Thoughts
- `src/tools/` - Research tool definitions and implementations
- `src/browser/` - Browser management for web interactions
- `src/reporting/` - Report generation and formatting
- `src/types/` - Shared type definitions

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/deepresearch.git
cd deepresearch

# Install dependencies
npm install

# Create .env file with your API keys
cp .env.example .env
# Then edit .env with your API keys
```

## Configuration

Create a `.env` file in the root directory with:

```
OPENAI_API_KEY=your_openai_api_key
SERPAPI_KEY=your_serpapi_key
```

## Usage

```typescript
import { DeepSearch } from './src/DeepSearch';

// Initialize DeepSearch
const deepSearch = new DeepSearch();

// Conduct research on a topic
const report = await deepSearch.research('Impact of artificial intelligence on job market');
console.log(report);
```

Or use the built-in command line tool:

```bash
# Run research with default topic
npm start

# Run research with custom topic
npm start "Quantum computing applications in healthcare"
```

## Report Output

Research reports are saved in the `reports/` directory as Markdown files. Each report includes:

- Executive Summary
- Key Findings/Statistics
- Analysis
- Implications
- Recommendations
- Sources
- Research Methodology (including reasoning paths explored)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
