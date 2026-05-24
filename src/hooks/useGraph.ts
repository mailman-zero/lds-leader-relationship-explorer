import { useState, useEffect } from "react";
import type { Graph } from "../graph/types";
import { loadRawData } from "../graph/loader";
import { buildGraph } from "../graph/builder";

let cachedGraph: Graph | null = null;
let loadPromise: Promise<Graph> | null = null;

async function loadGraph(): Promise<Graph> {
  if (cachedGraph) return cachedGraph;
  if (!loadPromise) {
    loadPromise = loadRawData().then(({ people, relationships, positions, temples }) => {
      cachedGraph = buildGraph(people, relationships, positions, temples);
      return cachedGraph;
    });
  }
  return loadPromise;
}

export function useGraph(): { graph: Graph | null; loading: boolean; error: string | null } {
  const [graph, setGraph] = useState<Graph | null>(cachedGraph);
  const [loading, setLoading] = useState(!cachedGraph);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedGraph) return;
    loadGraph()
      .then((g) => { setGraph(g); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  return { graph, loading, error };
}
