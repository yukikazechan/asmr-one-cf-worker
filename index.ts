/**
 * This is a Cloudflare Worker that implements a simple ASMR search system.
 * It allows:
 * - Searching ASMR works via an API
 * - Getting random ASMR works
 * - Communicates via Server-Sent Events (SSE)
 */

import type { ExecutionContext } from '@cloudflare/workers-types';

// import { Server } from "@modelcontextprotocol/sdk/server/index.js"; // To be removed
// import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"; // To be removed
// import {
//   CallToolRequestSchema,
//   ListToolsRequestSchema,
//   McpError,
//   ErrorCode,
// } from "@modelcontextprotocol/sdk/types.js"; // To be removed or adapted
// import axios from "axios"; // Replaced with fetch

interface AsmrWork {
  id: number;
  title: string;
  circle_id: number;
  name: string;
  nsfw: boolean;
  release: string;
  dl_count: number;
  price: number;
  review_count: number;
  rate_count: number;
  rate_average_2dp: number;
  rate_count_detail: any[];
  rank: any;
  has_subtitle: boolean;
  create_date: string;
  vas: any[];
  tags: any[];
  language_editions: any[];
  original_workno: any;
  other_language_editions_in_db: any[];
  translation_info: any;
  work_attributes: string;
  age_category_string: string;
  duration: number;
  source_type: string;
  source_id: string;
  source_url: string;
  userRating: any;
  playlistStatus: any;
  circle: {
    id: number;
    name: string;
    source_id: string;
    source_type: string;
  };
  samCoverUrl: string;
  thumbnailCoverUrl: string;
  mainCoverUrl: string;
}

interface AsmrTag {
  name: string;
  alias: string[];
}

interface AsmrPagination {
  currentPage: number;
  pageSize: number;
  totalCount: number;
}

interface AsmrSearchResponse {
  works: AsmrWork[];
  pagination: AsmrPagination;
}

// Function to calculate Levenshtein distance between two strings
function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  const costs: number[] = [];

  if (an === 0) return bn;
  if (bn === 0) return an;

  for (let i = 0; i <= bn; i++) {
    costs[i] = i;
  }

  for (let i = 1; i <= an; i++) {
    costs[0] = i;
    let lastValue = i - 1;
    for (let j = 1; j <= bn; j++) {
      const newValue = Math.min(
        costs[j] + 1,
        costs[j - 1] + 1,
        lastValue + (a[i - 1] !== b[j - 1] ? 1 : 0)
      );
      lastValue = costs[j];
      costs[j] = newValue;
    }
  }
  return costs[bn];
}

const ASMR_BASE_URL = "https://api.asmr-200.com/api";
// let tagMap: { [key: string]: string } = {}; // Commented out for debugging worker hang

/* // Commented out entire loadTags function for debugging worker hang
async function loadTags() {
  console.error("loadTags: Starting tag loading process.");
  try {
    const response = await fetch(`${ASMR_BASE_URL}/tags/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tags: ${response.status} ${response.statusText}`);
    }
    console.error("loadTags: API response received.");
    const tags = await response.json() as AsmrTag[];
    console.error("loadTags: Raw tags fetched. Count:", tags.length); 
    tagMap = tags.reduce((acc: { [key: string]: string }, tag: AsmrTag) => {
      acc[tag.name] = tag.name;
      if (tag.alias && Array.isArray(tag.alias)) {
        tag.alias.forEach((alias: string) => {
          acc[alias] = tag.name;
        });
      }
      tag.name.split('/').forEach(part => {
        if (part) {
          acc[part] = tag.name;
        }
      });
      if (tag.name.includes('/')) {
        acc[tag.name] = tag.name;
      }
      if (tag.alias && Array.isArray(tag.alias)) {
        tag.alias.forEach(alias => {
          if (typeof alias === 'string') {
            alias.split('/').forEach(part => {
              if (part) {
                acc[part] = tag.name;
              }
            });
            if (alias.includes('/')) {
              acc[alias] = tag.name;
            }
          }
        });
      }
      return acc;
    }, {} as { [key: string]: string });
    tagMap["义父"] = "叔父/义父";
    console.error("loadTags: Tags processed and tagMap populated.");
    console.error("loadTags: Final tagMap populated. Keys count:", Object.keys(tagMap).length);
  } catch (error: any) {
    console.error("loadTags: Failed to load tags:", error.message);
    if (error.cause) {
      console.error("loadTags: Error cause:", error.cause);
    }
    throw error; // Re-throw to be caught by caller
  }
}
*/

async function handleSearchAsmr(requestArgs: any, sseWriter: any) { // sseWriter to be defined
  try {
    const {
      query,
      order = "nsfw",
      sort = "asc",
      page = 1,
      pageSize = 20,
      subtitle = 0,
      includeTranslationWorks = true,
      link_type = "asmr_one"
    } = requestArgs;

    let processedQuery = query;
    const rjMatch = query.match(/^[Rr][Jj](\d+)$/);
    if (rjMatch && rjMatch[1]) {
      processedQuery = rjMatch[1];
    }
    let finalQuery = processedQuery;

    if (processedQuery.startsWith('$tag:')) {
      // Temporarily disable tag search for debugging worker hang
      const tagDisabledError = new Error("Tag search is temporarily disabled due to an ongoing issue. Please try searching without a tag.");
      console.error(tagDisabledError.message);
      throw tagDisabledError;
      /* // Original tagMap logic commented out
      const userTag = processedQuery.substring(5);
      if (tagMap[userTag]) {
        finalQuery = `$tag:${tagMap[userTag]}`;
      } else {
        let bestMatchTag = userTag;
        let minDistance = Infinity;
        const tagNames = Object.values(tagMap);
        for (const apiTag of tagNames) {
          const distance = levenshteinDistance(userTag, apiTag);
          if (distance < minDistance) {
            minDistance = distance;
            bestMatchTag = apiTag;
          }
        }
        const similarityThreshold = 2;
        if (minDistance <= similarityThreshold) {
          finalQuery = `$tag:${bestMatchTag}`;
          console.error(`User tag "${userTag}" not found, using similar tag "${bestMatchTag}" (distance: ${minDistance})`);
          // sseWriter.write({ event: "info", data: `User tag "${userTag}" not found, using similar tag "${bestMatchTag}" (distance: ${minDistance})` });
        } else {
          const errorMsg = `Tag "${userTag}" not found and no sufficiently similar tag found in ASMR API. Please check the tag or try a different one.`;
          console.error(errorMsg);
          // sseWriter.write({ event: "error", data: errorMsg });
          // return; // Or throw error to be caught by main handler
          throw new Error(errorMsg);
        }
      }
      */
    }

    let queryToEncode = finalQuery;
    if (queryToEncode.startsWith('$tag:')) { // This condition might still be met if query itself is "$tag:something"
      queryToEncode = ` ${queryToEncode}$`; // This logic might need review if tag search is re-enabled
    }
    const encodedQuery = encodeURIComponent(queryToEncode);
    const params = new URLSearchParams();
    params.append('order', order);
    params.append('sort', sort);
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    params.append('subtitle', subtitle.toString());
    params.append('includeTranslationWorks', includeTranslationWorks.toString());

    const url = `${ASMR_BASE_URL}/search/${encodedQuery}?${params.toString()}`;
    console.error(`Requesting URL: ${url}`);
    // sseWriter.write({ event: "info", data: `Requesting URL: ${url}` });

    const fetchResponse = await fetch(url);
    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      throw new Error(`ASMR API error for search: ${fetchResponse.status} ${fetchResponse.statusText} - ${errorText}`);
    }
    const responseData = await fetchResponse.json() as AsmrSearchResponse;

    const works = responseData.works.map((work) => {
      let link = "";
      if (link_type === "dlsite") {
        link = work.source_url;
      } else {
        link = `https://www.asmr-one.com/works/${work.id}`;
      }
      return {
        id: work.id,
        title: work.title,
        circle_name: work.circle.name,
        release_date: work.release,
        dl_count: work.dl_count,
        price: work.price,
        link: link
      };
    });

    // sseWriter.write({ event: "data", data: JSON.stringify({ works, pagination: responseData.pagination }) });
    return { works, pagination: responseData.pagination };

  } catch (error: any) {
    // The error object from fetch should be an Error instance with a message.
    console.error("search_asmr error:", error.message ? error.message : error);
    // sseWriter.write({ event: "error", data: { message: error.message || 'Search operation failed' } });
    // sseWriter.close();
    throw error; // Re-throw the original error object
  }
}
// Misplaced block removed

async function handleRandomAsmr(requestArgs: any, sseWriter: any) { // sseWriter to be defined
  try {
    const url = `${ASMR_BASE_URL}/works?order=betterRandom`;
    console.error(`Requesting URL: ${url}`);
    // sseWriter.write({ event: "info", data: `Requesting URL: ${url}` });

    const fetchResponse = await fetch(url);
     if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      throw new Error(`ASMR API error for random: ${fetchResponse.status} ${fetchResponse.statusText} - ${errorText}`);
    }
    const responseData = await fetchResponse.json();
    // sseWriter.write({ event: "data", data: JSON.stringify(responseData) });
    return responseData;

  } catch (error: any) {
    // The error object from fetch should be an Error instance with a message.
    console.error("random_asmr error:", error.message ? error.message : error);
    // sseWriter.write({ event: "error", data: { message: error.message || 'Random operation failed' } });
    // sseWriter.close();
    throw error; // Re-throw the original error object
  }
}


export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    // Initialize SSE stream
    let streamController: ReadableStreamController<any>;
    const stream = new ReadableStream({
      start(controller) {
        streamController = controller;
      },
      cancel() {
        console.log("SSE stream cancelled by client.");
      }
    });

    const sendEvent = (event: string, data: any) => {
      if (streamController) {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        streamController.enqueue(new TextEncoder().encode(message));
      }
    };

    const closeStream = () => {
      if (streamController) {
        streamController.close();
      }
    };

    // Helper to send initial headers and keep connection open for SSE
    const responseHeaders = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*', // Adjust for security in production
    };

    // Route based on pathname
    if (pathname === '/') { // Handle root path for MCP SSE connection
      // Send an initial event to confirm connection
      sendEvent('mcp_info', { status: 'connected', message: 'ASMR One CF Worker ready (Tag functionality limited for testing).' });
      // Keep the stream open for further MCP messages.
      // For now, we just establish the stream.
      // loadTags() is completely removed from this path for debugging.
      return new Response(stream, { headers: responseHeaders });

    } else if (pathname === '/sse/search' && request.method === 'GET') {
      // Tag loading logic is removed for debugging.
      // if (Object.keys(tagMap).length === 0) {
      //   try {
      //     // await loadTags(); // loadTags is disabled
      //     if (Object.keys(tagMap).length === 0) { 
      //       sendEvent('error', { message: 'Failed to load tags, search cannot proceed (tags disabled).' });
      //       closeStream();
      //       return new Response(stream, { headers: responseHeaders });
      //     }
      //   } catch (e: any) {
      //     console.error("Failed to load tags during /sse/search request (tags disabled):", e);
      //     sendEvent('error', { message: `Failed to initialize tags for search (tags disabled): ${e.message}` });
      //     closeStream();
      //     return new Response(stream, { headers: responseHeaders });
      //   }
      // }

      // Extract params from query string
      const queryParams: any = {};
      for (const [key, value] of searchParams.entries()) {
        if (key === 'page' || key === 'pageSize' || key === 'subtitle') {
          queryParams[key] = parseInt(value, 10);
        } else if (key === 'includeTranslationWorks') {
          queryParams[key] = value === 'true';
        } else {
          queryParams[key] = value;
        }
      }

      if (!queryParams.query) {
        sendEvent('error', { message: "Missing 'query' parameter for search" });
        closeStream();
        return new Response(stream, { headers: responseHeaders });
      }
      
      // Return the stream response immediately
      const promise = handleSearchAsmr(queryParams, { write: sendEvent, close: closeStream })
        .then(result => {
          sendEvent('data', result);
        })
        .catch(error => {
          sendEvent('error', { message: error.message || 'Search operation failed' });
        })
        .finally(() => {
          closeStream();
        });
      ctx.waitUntil(promise); // Ensure the async operation completes
      return new Response(stream, { headers: responseHeaders });

    } else if (pathname === '/sse/random' && request.method === 'GET') {
      const promise = handleRandomAsmr({}, { write: sendEvent, close: closeStream })
        .then(result => {
          sendEvent('data', result);
        })
        .catch(error => {
          sendEvent('error', { message: error.message || 'Random operation failed' });
        })
        .finally(() => {
          closeStream();
        });
      ctx.waitUntil(promise);
      return new Response(stream, { headers: responseHeaders });

    } else if (pathname === '/load-tags-debug' && request.method === 'GET') {
        // Debug endpoint to trigger tag loading and see the map
        return new Response("Tag loading is currently disabled for debugging worker hang issue.", { 
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
        /* // Original debug logic commented out
        try {
            // await loadTags(); // loadTags is disabled
            return new Response(JSON.stringify(tagMap, null, 2), { 
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e: any) {
            return new Response(`Error loading tags: ${e.message}`, { status: 500 });
        }
        */
    }

    return new Response('Not Found. Supported paths: /, /sse/search?query=..., /sse/random', { status: 404 });
  },
};

// Helper for SSE (if needed outside the main fetch handler, though above is integrated)
// class SseWriter {
//   private controller: ReadableStreamController<any>;
//   private encoder = new TextEncoder();

//   constructor(controller: ReadableStreamController<any>) {
//     this.controller = controller;
//   }

//   write(event: string, data: any) {
//     if (this.controller) {
//       const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
//       this.controller.enqueue(this.encoder.encode(message));
//     }
//   }

//   close() {
//     if (this.controller) {
//       this.controller.close();
//     }
//   }
// }