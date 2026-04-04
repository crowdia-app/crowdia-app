#!/usr/bin/env npx tsx

function printUsage() {
  console.log(`
Crowdia Event Scout Agents

Usage: npx tsx agents/index.ts [options]

Options:
  --extraction        Run only the extraction agent (default)
  --discovery         Run only the discovery agent
  --both              Run both agents
  --max-sources=N     Limit extraction to N sources (default: all)
  --dry-run           Show what would be done without making changes
  --help, -h          Show this help message

Examples:
  npm run agents                         # Run extraction agent
  npm run agents:extract                 # Run extraction agent
  npm run agents:discover                # Run discovery agent
  npm run agents:both                    # Run both agents
  npm run agents -- --max-sources=20     # Run extraction with max 20 sources
  npm run agents -- --dry-run            # Preview without changes

Environment variables required:
  SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY
  OPEN_ROUTER_API_KEY
  BRAVE_API_KEY
  GOOGLE_MAPS_API_KEY
  SLACK_WEBHOOK_URL (optional)
`);
}

// Handle --help before loading any modules
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage();
  process.exit(0);
}

type AgentType = "extraction" | "discovery" | "both";

async function main() {
  // Import modules after help check
  const { validateConfig } = await import("./config");
  const { runExtractionAgent } = await import("./extraction");
  const { runDiscoveryAgent } = await import("./discovery");
  const { generateMissingEmbeddings } = await import("./generate-embeddings");

  // Parse command line arguments
  const args = process.argv.slice(2);
  const agentType = parseAgentType(args);
  const dryRun = args.includes("--dry-run");
  const maxSources = parseMaxSources(args);

  console.log("=".repeat(50));
  console.log("Crowdia Event Scout Agents");
  console.log("=".repeat(50));
  console.log(`Agent: ${agentType}`);
  console.log(`Dry run: ${dryRun}`);
  if (maxSources) console.log(`Max sources: ${maxSources}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log("=".repeat(50));

  if (dryRun) {
    console.log("\n[DRY RUN MODE] Would execute the following:");
    if (agentType === "extraction" || agentType === "both") {
      console.log("  - Extraction Agent: Fetch sources, extract events, save to DB");
    }
    if (agentType === "discovery" || agentType === "both") {
      console.log("  - Discovery Agent: Search for new event sources, save to DB");
    }
    console.log("\nExiting without making changes.");
    return;
  }

  // Validate environment before running
  validateConfig();

  try {
    if (agentType === "discovery" || agentType === "both") {
      console.log("\n--- Running Discovery Agent ---\n");
      await runDiscoveryAgent();
    }

    if (agentType === "extraction" || agentType === "both") {
      console.log("\n--- Running Extraction Agent ---\n");
      await runExtractionAgent({ maxSourcesPerRun: maxSources });
    }

    // After extraction, generate embeddings for any new events (enables RAG search)
    if (agentType === "extraction" || agentType === "both") {
      console.log("\n--- Generating missing embeddings ---\n");
      await generateMissingEmbeddings();
    }

    console.log("\n" + "=".repeat(50));
    console.log("Event Scout completed successfully!");
    console.log(`Finished: ${new Date().toISOString()}`);
    console.log("=".repeat(50));

    process.exit(0);
  } catch (error) {
    console.error("\n" + "=".repeat(50));
    console.error("Event Scout failed!");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("=".repeat(50));

    process.exit(1);
  }
}

function parseAgentType(args: string[]): AgentType {
  if (args.includes("--discovery")) return "discovery";
  if (args.includes("--extraction")) return "extraction";
  if (args.includes("--both")) return "both";
  return "extraction";
}

function parseMaxSources(args: string[]): number | undefined {
  const arg = args.find(a => a.startsWith("--max-sources="));
  if (arg) {
    const value = parseInt(arg.split("=")[1], 10);
    if (!isNaN(value) && value > 0) return value;
  }
  return undefined;
}

main();
