import { DeepSearch } from './DeepSearch';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Check if required environment variables are set
function checkEnvironment() {
  const missingVars = [];
  
  if (!process.env.SERPAPI_KEY) {
    missingVars.push('SERPAPI_KEY');
  }
  
  if (!process.env.OPENAI_API_KEY) {
    missingVars.push('OPENAI_API_KEY');
  }
  
  if (missingVars.length > 0) {
    console.error('\nError: Missing required environment variables:');
    console.error(missingVars.join(', '));
    console.error('\nPlease add these to your .env file in the root directory.');
    console.error('Example:');
    console.error('SERPAPI_KEY=your_serpapi_key_here');
    console.error('OPENAI_API_KEY=your_openai_api_key_here\n');
    return false;
  }
  
  return true;
}

// Save research report to file
function saveReport(topic: string, report: string): string {
  // Create reports directory if it doesn't exist
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }
  
  // Create sanitized filename from topic
  const sanitizedTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${sanitizedTopic}_${timestamp}.md`;
  const filepath = path.join(reportsDir, filename);
  
  // Write report to file
  fs.writeFileSync(filepath, `# Research Report: ${topic}\n\n${report}`);
  
  return filepath;
}

// Usage example
async function runExample() {
  try {
    console.log('\n🔍 DeepSearch - AI-Powered Research (改進版)');
    console.log('=======================================');
    
    // Check environment variables first
    if (!checkEnvironment()) {
      process.exit(1);
    }
    
    // Initialize DeepSearch (API keys loaded from .env file)
    const deepSearch = new DeepSearch();
    
    // Define research topic
    const researchTopic = process.argv[2] || 'Impact of artificial intelligence on job market';
    console.log(`\n📋 Researching topic: "${researchTopic}"\n`);
    
    // Display diagnostics information
    console.log('System info:');
    console.log('- Platform:', process.platform);
    console.log('- Node version:', process.version);
    console.log('- Bun version:', process.versions.bun || 'unknown');
    console.log('- Memory usage:', `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
    console.log('');
    
    // Start the research process
    console.log('⏳ Beginning research process. This may take several minutes...\n');
    
    // Track start time
    const startTime = Date.now();
    
    // Periodically log state to show progress
    const interval = setInterval(() => {
      const state = deepSearch.getState();
      const elapsedMinutes = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`[${elapsedMinutes} min] Current status: ${state.status.toUpperCase()} - ${state.currentStep}`);
      console.log(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
    }, 30000); // Log every 30 seconds
    
    // Run the research
    const report = await deepSearch.research(researchTopic);
    
    // Clear the interval timer
    clearInterval(interval);
    
    // Calculate total time
    const totalMinutes = ((Date.now() - startTime) / 60000).toFixed(1);
    console.log(`\n✅ Research completed in ${totalMinutes} minutes.\n`);
    
    // Save report to file
    const filepath = saveReport(researchTopic, report);
    console.log(`📄 Report saved to: ${filepath}\n`);
    
    // Display report
    console.log('\n===== RESEARCH REPORT =====\n');
    console.log(report);
    console.log('\n===== END OF REPORT =====\n');
    
  } catch (error) {
    console.error('\n❌ Error running research:', (error as Error).message);
    console.error('Stack trace:', (error as Error).stack);
    process.exit(1);
  }
}

// Run the example
runExample().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 